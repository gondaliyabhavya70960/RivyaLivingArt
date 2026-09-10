#!/usr/bin/env node
/**
 * A LOCAL POSTGREST, so the public site can be run and tested without a Supabase project.
 *
 * WHY THIS EXISTS. `npm run db:reset` gives us a real PostgreSQL cluster with every migration, every
 * policy and the seeded content — but the application does not talk to PostgreSQL. `supabase-js`
 * speaks HTTP to PostgREST, so from Phase 10 onward (the first phase whose deliverable is a page a
 * visitor loads) a bare Postgres verifies nothing: no route can be requested, no RLS-filtered read
 * can be observed, and every e2e test is unrunnable. This closes that gap with the same component
 * Supabase itself runs, pointed at the same local cluster.
 *
 * IT IS A DEVELOPMENT AND CI TOOL, NEVER A DEPLOYMENT. It binds to 127.0.0.1, it mints its own
 * throwaway JWT secret on every run, and it is never imported by application code. The `verify`
 * job in .github/workflows/ci.yml runs `next build` against it, over the database the job has just
 * migrated and seeded, because pre-rendering reads content and CI holds no Supabase project to
 * read it from — nor should it. Nothing here reads or writes
 * `.env.local`: the variables are printed for the caller to put in front of a command, because
 * a script that edits the developer's environment file is a script that eventually overwrites a
 * real credential with a fake one.
 *
 * THE PROXY IN FRONT IS NOT DECORATION. `supabase-js` appends `/rest/v1` to its base URL; PostgREST
 * serves tables at the root. Without the rewrite every request 404s, which looks exactly like an
 * empty database. It also injects `Accept-Profile`/`Content-Profile` the way Supabase's gateway
 * does, so embedded selects behave the same here as they do in production.
 *
 *   node scripts/db/local-rest.mjs            # runs until interrupted, prints the two variables
 *   POSTGREST_BIN=/path/to/postgrest node scripts/db/local-rest.mjs
 *
 * The binary is not vendored. Fetch it from PostgREST's releases and point `POSTGREST_BIN` at it;
 * the version Supabase runs is the one to match.
 */
import { spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { createServer, request as httpRequest } from 'node:http'
import { existsSync } from 'node:fs'

const POSTGREST_BIN = process.env.POSTGREST_BIN ?? 'postgrest'
const DB_URI = process.env.DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:5433/rivya'
/** The port the application is told about. */
const GATEWAY_PORT = Number(process.env.LOCAL_REST_PORT ?? 3001)
/** PostgREST itself, behind the gateway. */
const PGRST_PORT = GATEWAY_PORT + 1

/**
 * A fresh secret per run.
 *
 * NOT A CONSTANT, and not read from the environment. A committed or reused JWT secret is one that
 * ends up in a real deployment by copy-paste; regenerating it each run makes that impossible and
 * costs nothing, because the anon key is printed alongside it.
 */
const JWT_SECRET = randomBytes(32).toString('hex')

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** An HS256 JWT shaped the way Supabase shapes its anon key: a role claim and nothing else. */
function mintKey(role) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(
    JSON.stringify({ role, iss: 'supabase-local', iat: now, exp: now + 60 * 60 * 24 }),
  )
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${header}.${payload}.${signature}`
}

if (POSTGREST_BIN === 'postgrest' && !existsSync('/usr/bin/postgrest')) {
  // Not fatal: `postgrest` may be on PATH somewhere else. Say so once rather than failing on a
  // spawn error whose message ("ENOENT") explains nothing.
  console.error('▸ postgrest not found at /usr/bin — relying on PATH, or set POSTGREST_BIN')
}

const anonKey = mintKey('anon')
/**
 * A SERVICE-ROLE KEY AS WELL, because from Phase 24 onward half the write paths do not have a
 * session at all. The bulk engine, the search log and the research pipeline all write through
 * `createAdminClient()`, which authenticates as `service_role` and bypasses RLS; a shim that
 * minted only an anon key could exercise the reading half of the application and none of the
 * writing half, and the missing half is the one that changes live content.
 *
 * IT IS NOT A BACK DOOR. It is signed with the same per-run throwaway secret as the anon key,
 * against a cluster bound to 127.0.0.1, and it is printed rather than written anywhere — the same
 * terms the anon key has always been on.
 */
const serviceKey = mintKey('service_role')

const pgrst = spawn(
  POSTGREST_BIN,
  [
    // PostgREST takes its whole configuration from the environment when given no config file.
  ],
  {
    env: {
      ...process.env,
      PGRST_DB_URI: DB_URI,
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_SERVER_PORT: String(PGRST_PORT),
      PGRST_SERVER_HOST: '127.0.0.1',
      // Matches Supabase: the pool is small because this serves one developer.
      PGRST_DB_POOL: '10',
      PGRST_LOG_LEVEL: process.env.PGRST_LOG_LEVEL ?? 'error',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  },
)

pgrst.on('error', (error) => {
  console.error(`✗ could not start postgrest: ${error.message}`)
  process.exit(1)
})

/** `/rest/v1/pages?...` → `/pages?...`; anything else is passed through unchanged. */
const gateway = createServer((clientReq, clientRes) => {
  const path = clientReq.url ?? '/'
  const rewritten = path.startsWith('/rest/v1') ? path.slice('/rest/v1'.length) || '/' : path

  const upstream = httpRequest(
    {
      host: '127.0.0.1',
      port: PGRST_PORT,
      method: clientReq.method,
      path: rewritten,
      headers: { ...clientReq.headers, host: `127.0.0.1:${PGRST_PORT}` },
    },
    (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(clientRes)
    },
  )

  upstream.on('error', (error) => {
    clientRes.writeHead(502, { 'content-type': 'application/json' })
    clientRes.end(JSON.stringify({ error: 'upstream', detail: error.message }))
  })

  clientReq.pipe(upstream)
})

gateway.listen(GATEWAY_PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  Local PostgREST is up. Put these in front of a command:')
  console.log('')
  console.log(`    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${GATEWAY_PORT} \\`)
  console.log(`    NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey} \\`)
  console.log(`    SUPABASE_SERVICE_ROLE_KEY=${serviceKey} \\`)
  console.log('    npm run dev')
  console.log('')
  console.log('  Both keys are throwaways signed with a secret generated for this run only.')
  console.log('')
})

/** Both processes go down together; a stranded PostgREST holds the port and confuses the next run. */
function shutdown() {
  gateway.close()
  pgrst.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
pgrst.on('exit', (code) => {
  console.error(`✗ postgrest exited with code ${code}`)
  gateway.close()
  process.exit(code ?? 1)
})
