#!/usr/bin/env node
/**
 * BUNDLE SECRET GATE (Phase 04)
 *
 * Runs after `npm run build`. The service-role key bypasses Row Level Security for every table in
 * the project, so the one place it must never reach is a file a browser can download. ESLint's
 * `no-restricted-imports` rule and `import 'server-only'` both guard the SOURCE; this reads the
 * BUILD, which is the only artefact that actually ships.
 *
 * Three detectors:
 *
 *   1. `SUPABASE_SERVICE_ROLE_KEY` — the environment variable name. Its presence in a client
 *      chunk means the reference survived tree-shaking, which is how the value follows.
 *   2. `service_role` — the Postgres role name, lower-case as Supabase writes it. Matched
 *      separately from (1) so the two never shadow each other: the env-var name is upper-case.
 *   3. A JWT whose PAYLOAD base64url-decodes to mention `service_role`. Detector (2) cannot see
 *      this — the claim is encoded, not literal. This is the one that catches a pasted key. The
 *      anon key is also a JWT and also ships on purpose; its payload says `anon`, so it passes.
 *
 * `.next/static/**` is a HARD failure — that directory is served to browsers verbatim.
 * `.next/server/**` is reported as an advisory only: `process.env.SUPABASE_SERVICE_ROLE_KEY`
 * legitimately survives into a server chunk, and failing on it would train people to ignore this
 * script. A finding there is worth reading, not worth blocking on.
 *
 * NOTHING MATCHED IS EVER PRINTED. Not the value, not a prefix, not a length, not a redacted
 * silhouette — a file path and a byte offset are enough to find it, and a build log is not a
 * confidential surface (CLAUDE.md, "never log or display a secret value"). Byte offsets rather
 * than line numbers because the files are minified: line 1, column 402831 helps nobody.
 *
 * Exit 1 on any finding under .next/static, or when there is no build to inspect.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const STATIC_DIR = join(ROOT, '.next/static')
const SERVER_DIR = join(ROOT, '.next/server')

/** Beyond this many findings in one file, the rest are counted rather than listed. */
const MAX_PER_FILE = 20

/* ------------------------------------------------------------------ file walk */

/**
 * Everything, with no extension filter on purpose. A key can be pasted into a JSON manifest, a
 * source map, an inlined SVG or a `.txt` flight payload as easily as into a `.js` chunk, and
 * deciding in advance which file types are "code" is how a gate acquires a blind spot.
 */
function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/* ------------------------------------------------------------------ detectors */

/**
 * Read as latin1 so one character is one byte: the reported offset is then a true byte offset into
 * the file, which is what `xxd -s` and an editor's go-to-byte both want. Decoding as UTF-8 would
 * shift every offset after the first multi-byte character.
 */
const readBytesAsChars = (file) => readFileSync(file).toString('latin1')

const LITERALS = [
  {
    label: 'the SUPABASE_SERVICE_ROLE_KEY environment variable name',
    needle: 'SUPABASE_SERVICE_ROLE_KEY',
  },
  { label: 'the literal string service_role', needle: 'service_role' },
]

/** Three base64url segments, the first opening `eyJ` — a JSON header, i.e. a JWT rather than a hash. */
const JWT = /eyJ[A-Za-z0-9_-]{6,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g

function findingsIn(text) {
  const found = []

  for (const { label, needle } of LITERALS) {
    let at = text.indexOf(needle)
    while (at !== -1) {
      found.push({ offset: at, label })
      at = text.indexOf(needle, at + needle.length)
    }
  }

  JWT.lastIndex = 0
  for (let m = JWT.exec(text); m !== null; m = JWT.exec(text)) {
    let payload
    try {
      payload = Buffer.from(m[1], 'base64url').toString('utf8')
    } catch {
      continue // Not decodable, so not a key — a hash or an asset name that happens to fit.
    }
    // Deliberately a substring test, not a JSON parse: a truncated or re-wrapped payload is still
    // a leak, and this must not be defeatable by making the claim harder to parse.
    if (payload.includes('service_role')) {
      found.push({ offset: m.index, label: 'a JWT whose payload carries a service_role claim' })
    }
  }

  return found.sort((a, b) => a.offset - b.offset)
}

function scan(dir) {
  const results = []
  for (const file of walk(dir)) {
    const found = findingsIn(readBytesAsChars(file))
    if (found.length) results.push({ file: relative(ROOT, file), found })
  }
  return results
}

/* ------------------------------------------------------------------ report */

/**
 * A shipped finding is listed occurrence by occurrence — somebody is about to go and look at every
 * one. An advisory is collapsed to a line per file: `.js.map` files inline the source of
 * `lib/supabase/admin.ts`, so a normal build produces dozens of them, and dozens of lines of
 * expected output is how a gate stops being read at all.
 */
const report = (results, collapse) => {
  for (const { file, found } of results) {
    if (collapse) {
      const first = found[0]
      console.error(
        `  ${file}  ${found.length} occurrence(s), first at byte ${first.offset} — ${first.label}`,
      )
      continue
    }
    for (const f of found.slice(0, MAX_PER_FILE)) {
      console.error(`  ${file}  byte ${f.offset}  — ${f.label}`)
    }
    if (found.length > MAX_PER_FILE) {
      console.error(`  ${file}  … and ${found.length - MAX_PER_FILE} further occurrence(s)`)
    }
  }
}

const count = (results) => results.reduce((n, r) => n + r.found.length, 0)

let hasStatic = false
try {
  hasStatic = statSync(STATIC_DIR).isDirectory()
} catch {
  hasStatic = false
}

if (!hasStatic) {
  console.error('No build to inspect: .next/static is missing. Run `npm run build` first.')
  process.exit(1)
}

const shipped = scan(STATIC_DIR)
const server = scan(SERVER_DIR)

if (server.length) {
  console.warn('Advisory — service-role references in .next/server (server-only, not shipped):\n')
  report(server, true)
  console.warn('')
}

if (shipped.length) {
  console.error('SERVICE-ROLE MATERIAL IN THE CLIENT BUNDLE:\n')
  report(shipped, false)
  console.error(
    `\n${count(shipped)} finding(s) in .next/static — this directory is served to browsers.\n` +
      'Treat the key as compromised: rotate it in the Supabase dashboard before fixing the build.',
  )
  process.exit(1)
}

console.log(
  'bundle secrets: clean — no service-role key name, role name or service_role JWT in .next/static',
)
