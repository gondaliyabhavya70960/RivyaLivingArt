#!/usr/bin/env node
/**
 * THE DOCUMENTATION CONTRACT, AS A GATE — Phase 44, gate 5 of `scripts/ops/preflight.ts`.
 *
 * `ENVIRONMENT.md` §1 states a four-step contract for adding an environment variable, and step 4 is
 * the one nobody does: the name goes into `.env.example` and into the code, and the document that
 * explains what it is for and who rotates it never changes. Six months later somebody finds a
 * variable in a Vercel dashboard with no record of why it exists or whether it is safe to remove.
 *
 * SO THIS COMPARES TWO SETS. Every variable name in `.env.example` must appear somewhere in
 * `docs/ops/ENVIRONMENT.md`, and every variable the code READS must appear in `.env.example`. Both
 * directions matter: the first catches a name nobody documented, the second catches a name nobody
 * declared.
 *
 * IT IS DELIBERATELY THE MINIMUM. Phase 01 named this script and Phase 46 extends it with the D7
 * document map, front-matter checks and the claim vocabulary. What it must do TODAY is be a real
 * gate rather than a filename in a runbook, because `preflight.ts` lists it as gate 5 and a gate
 * that does not exist is a line in a table.
 *
 * IT NEVER READS A VALUE. `.env.example` carries names with empty values by construction, and this
 * script takes the part before the `=` and discards the rest before anything else happens.
 *
 * Exit 1 on any variable that is used but not declared, or declared but not documented.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const EXAMPLE = '.env.example'
const DOC = 'docs/ops/ENVIRONMENT.md'

/**
 * Names that are read but are not ours to declare.
 *
 * `NODE_ENV` and `CI` come from the toolchain. The `VERCEL_*` family is injected by the platform and
 * `ENVIRONMENT.md` says so in its own section — D8 lists what the PROJECT sets, and asking the owner
 * to declare a variable they cannot set would be asking for a lie.
 */
const PLATFORM =
  /^(?:NODE_ENV|CI|VERCEL(?:_|$)|npm_|ANALYZE$|RLS_TESTS_REQUIRED$|PLAYWRIGHT|STUDIO_STORAGE_STATE$|DATABASE_URL$|PGPASSWORD$|POSTGREST|LOCAL_REST_PORT$|PRODUCTION_WHATSAPP_NUMBER$)/

const SOURCE_DIRS = ['app', 'lib', 'components', 'content', 'proxy.ts', 'next.config.ts']

function walk(entry, out = []) {
  const full = join(ROOT, entry)
  let stats
  try {
    stats = statSync(full)
  } catch {
    return out
  }
  if (stats.isFile()) {
    if (/\.(?:ts|tsx|mjs)$/.test(entry)) out.push(entry)
    return out
  }
  for (const child of readdirSync(full)) {
    if (child === 'node_modules' || child.startsWith('.')) continue
    walk(join(entry, child), out)
  }
  return out
}

/** The names declared in `.env.example`, ignoring comments and every value. */
function declaredNames() {
  const names = new Set()
  for (const line of readFileSync(join(ROOT, EXAMPLE), 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const name = trimmed.split('=')[0]?.trim()
    if (name !== undefined && name !== '') names.add(name)
  }
  return names
}

/** Every `process.env.X` and `process.env['X']` the product reads. */
function usedNames() {
  const names = new Map()
  for (const entry of SOURCE_DIRS) {
    for (const file of walk(entry)) {
      const source = readFileSync(join(ROOT, file), 'utf8')
      for (const match of source.matchAll(
        /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])/g,
      )) {
        const name = match[1] ?? match[2]
        if (name === undefined || PLATFORM.test(name)) continue
        if (!names.has(name)) names.set(name, file)
      }
      // `requiredEnv('X')` is the project's own accessor and is the common form.
      for (const match of source.matchAll(/required(?:Env)?\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g)) {
        const name = match[1]
        if (name === undefined || PLATFORM.test(name)) continue
        if (!names.has(name)) names.set(name, file)
      }
    }
  }
  return names
}

const declared = declaredNames()
const used = usedNames()
const documentation = readFileSync(join(ROOT, DOC), 'utf8')

const undeclared = [...used.entries()].filter(([name]) => !declared.has(name))
const undocumented = [...declared].filter((name) => !documentation.includes(name))

const problems = []

for (const [name, file] of undeclared) {
  problems.push(
    `${name} is read in ${file} but is not in ${EXAMPLE}.\n` +
      `      ENVIRONMENT.md §1 step 2: the name, with an EMPTY value, committed. It is the only\n` +
      `      committed reference anybody has.`,
  )
}

for (const name of undocumented) {
  problems.push(
    `${name} is declared in ${EXAMPLE} but is named nowhere in ${DOC}.\n` +
      `      ENVIRONMENT.md §1 step 4: purpose, scope, where it is set, what reads it, what breaks\n` +
      `      without it, and who rotates it.`,
  )
}

if (problems.length > 0) {
  console.error(`✗ documentation contract: ${String(problems.length)} problem(s):\n`)
  for (const problem of problems) console.error(`    ${problem}\n`)
  process.exit(1)
}

console.log(
  `✓ documentation contract: ${String(declared.size)} declared variable(s), all documented; ` +
    `${String(used.size)} read by the product, all declared`,
)
