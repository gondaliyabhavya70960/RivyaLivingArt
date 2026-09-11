#!/usr/bin/env node
/**
 * EVERY SERVER ACTION CHECKS A PERMISSION (Phase 41, SECURITY.md §9)
 *
 * A Server Action is a POST endpoint with a generated URL. Next exposes it to anybody who can reach
 * the site, whether or not the page that declares it was ever rendered for them — so "only the
 * Studio calls this" is not access control, it is a description of the happy path. RLS refuses
 * underneath, which is the real backstop; this gate is what keeps the layer above it honest.
 *
 * WHAT IT ASSERTS. Every exported async function in a module carrying `'use server'` reaches a
 * permission helper — `requirePermission`, `requireStaffSession`, `requireOwner` — or is explicitly
 * exempt with a written reason.
 *
 * IT FOLLOWS ONE LEVEL OF DELEGATION, AND THE LEVEL WAS CHOSEN BY WHAT THE CODEBASE DOES. The first
 * version looked only inside the action's own body and reported eighteen actions, every one of which
 * was correctly guarded: `research/changes/actions.ts` routes eleven actions through one `runAction`
 * helper that calls `requirePermission`; `research/sheets/actions.ts` has a local `setPaused`; the
 * Studio chrome's two actions delegate to `lib/auth/preferences.ts`, whose own comment says it
 * re-checks there precisely because a Server Action passes through no page. A gate that reports
 * eighteen false positives on its first run is a gate that gets an eighteen-line exemption list and
 * then gets ignored.
 *
 * So it resolves, for each exported action: its own body, the body of any function DECLARED IN THE
 * SAME FILE that it calls, and the body of any function it calls that is imported from `lib/`. One
 * level, not a full call graph — two levels of indirection between an endpoint and its permission
 * check is worth being made to write an exemption for.
 *
 * IT IS STILL A TEXT SCAN AND SAYS SO. It cannot see a guard behind a conditional, a dynamic call or
 * a class method, so a real check can still read as absent. That is the right direction to be wrong
 * in: the fix is a one-line exemption with a reason a reviewer reads.
 *
 * EXEMPTIONS ARE DATA, NOT SILENCE. Each carries a sentence; `npm run check` prints the count; a new
 * one is a diff somebody reads.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.cwd()
const EXTENSIONS = ['.ts', '.tsx']

/** A call that establishes who is asking and what they may do. */
const GUARDS = [
  'requirePermission',
  'requireStaffSession',
  'requireOwner',
  'requireSession',
  'getStaffSession',
]

/**
 * Actions that legitimately check nothing, each with the reason.
 *
 * THE TEST IS "COULD AN ANONYMOUS CALLER DO HARM WITH IT", not "is it convenient to exempt".
 */
const EXEMPT = new Map([
  [
    'app/(site)/announcement-actions.ts',
    'The announcement bar\u2019s dismiss control. The worst a forged call achieves is hiding a banner ' +
      'from the browser that sent it; it writes one bounded, pattern-checked cookie value and reads ' +
      'no table. Checking a permission would mean giving a visitor an account, which D1 forbids.',
  ],
  [
    'app/(site)/_actions/submit-inquiry.ts',
    'The only public write path (PHASE-16-22). A visitor has no account by design (D1), so there is ' +
      'no permission to check; what stands in for one is the rate limit, the Zod parse, the origin ' +
      'check and an RLS policy that admits an insert and no read.',
  ],
])

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '*.ts', '*.tsx'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)

/** `'use server'` at the top of the file, not inside one function. */
function isServerActionModule(source) {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use server['"]/.test(source.slice(0, 400))
}

/**
 * Every named function in a file, exported or not, as `name -> body`.
 *
 * Body extraction is brace matching from the opening `{`, over a copy with comments and strings
 * blanked, so a brace inside a string cannot end a function early.
 */
function functionsIn(source) {
  const masked = stripCommentsAndStrings(source, { strings: true })
  const found = new Map()
  const pattern = /(export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g
  for (const match of masked.matchAll(pattern)) {
    const name = match[2]
    /*
     * THE BODY'S BRACE, NOT THE FIRST BRACE AFTER THE NAME.
     *
     * `async function runAction(options: { … })` opens a brace inside the PARAMETER LIST, and taking
     * the first one found eleven correctly-guarded actions "unguarded" because the extracted body was
     * a destructured argument.
     *
     * A RETURN TYPE CAN CONTAIN A BRACE TOO: `): Promise<ActionResult<{ id: string }>> {` is a real
     * signature in this codebase and it defeated the first fix. So after the parameter list is
     * balanced, the scan tracks ANGLE-BRACKET depth and takes the first `{` at depth zero — inside
     * `Promise<…<{ … }>>` every brace is at depth two, and the body's is at depth nought.
     */
    const paren = (match.index ?? 0) + match[0].length - 1
    let parenDepth = 0
    let afterParams = -1
    for (let index = paren; index < masked.length; index += 1) {
      if (masked[index] === '(') parenDepth += 1
      else if (masked[index] === ')') {
        parenDepth -= 1
        if (parenDepth === 0) {
          afterParams = index
          break
        }
      }
    }
    if (afterParams === -1) continue
    let angle = 0
    let open = -1
    for (let index = afterParams + 1; index < masked.length; index += 1) {
      const character = masked[index]
      if (character === '<') angle += 1
      else if (character === '>') angle = Math.max(0, angle - 1)
      else if (character === '{' && angle === 0) {
        open = index
        break
      }
    }
    if (open === -1) continue
    let depth = 0
    let end = open
    for (let index = open; index < masked.length; index += 1) {
      if (masked[index] === '{') depth += 1
      else if (masked[index] === '}') {
        depth -= 1
        if (depth === 0) {
          end = index
          break
        }
      }
    }
    found.set(name, {
      name,
      exported: match[1] !== undefined,
      isAsync: /async/.test(match[0]),
      body: source.slice(open, end + 1),
    })
  }
  return found
}

/** `@/x` is the repository root. Only `lib/` is followed; a component is not a guard. */
function resolveLibImport(specifier, fromFile) {
  const base = specifier.startsWith('@/')
    ? join(ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : null
  if (base === null) return null
  for (const candidate of [base, ...EXTENSIONS.map((extension) => base + extension)]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  for (const extension of EXTENSIONS) {
    const indexFile = join(base, `index${extension}`)
    if (existsSync(indexFile)) return indexFile
  }
  return null
}

/** Imported name -> resolved file, for `lib/` imports only. */
function libImports(source, file) {
  const masked = stripCommentsAndStrings(source, { strings: false })
  const map = new Map()
  for (const match of masked.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[2]
    if (!specifier.startsWith('@/lib/') && !specifier.startsWith('.')) continue
    const resolved = resolveLibImport(specifier, file)
    if (resolved === null || !resolved.includes(`${ROOT}/lib/`)) continue
    for (const piece of match[1].split(',')) {
      const name = piece
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim()
      if (name !== undefined && name !== '' && !name.startsWith('type ')) map.set(name, resolved)
    }
  }
  return map
}

const libCache = new Map()
function libFunctions(file) {
  let found = libCache.get(file)
  if (found === undefined) {
    found = functionsIn(readFileSync(file, 'utf8'))
    libCache.set(file, found)
  }
  return found
}

/** Does this body, or anything it delegates to one level down, reach a guard? */
function reachesGuard(body, locals, imports) {
  if (GUARDS.some((guard) => body.includes(guard))) return true

  for (const [name, entry] of locals) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(body)) continue
    if (GUARDS.some((guard) => entry.body.includes(guard))) return true
  }

  for (const [name, file] of imports) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(body)) continue
    const entry = libFunctions(file).get(name)
    if (entry !== undefined && GUARDS.some((guard) => entry.body.includes(guard))) return true
  }

  return false
}

const problems = []
let modules = 0
let actions = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (!isServerActionModule(source)) continue
  modules += 1

  const exemption = EXEMPT.get(file)
  const locals = functionsIn(source)
  const imports = libImports(source, join(ROOT, file))

  for (const action of locals.values()) {
    if (!action.exported || !action.isAsync) continue
    actions += 1
    if (exemption !== undefined) continue
    if (reachesGuard(action.body, locals, imports)) continue
    problems.push(
      `${file} — \`${action.name}\` reaches no permission helper, in its own body or one level ` +
        'down. A Server Action is a POST endpoint anybody can call; add a `requirePermission(...)`, ' +
        'or add the file to EXEMPT in this script with a sentence saying why it needs none.',
    )
  }
}

// A stale exemption is worse than none: it silences a file that may have grown a new action since.
for (const file of EXEMPT.keys()) {
  if (!files.includes(file)) {
    problems.push(`${file} is exempt in this script but no longer exists — remove the exemption`)
  }
}

if (problems.length > 0) {
  console.error(`✗ action guards: ${String(problems.length)} problem(s):`)
  for (const problem of problems) console.error(`    ${problem}`)
  process.exit(1)
}

console.log(
  `✓ action guards: ${String(actions)} exported server action(s) across ${String(modules)} ` +
    `module(s) reach a permission helper; ${String(EXEMPT.size)} file(s) exempt with a stated reason`,
)
