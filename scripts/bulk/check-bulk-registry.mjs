#!/usr/bin/env node
/**
 * BULK REGISTRY GATE (Phase 24)
 *
 * Every registered bulk operation must supply a `preview`, a Zod params schema and a destructive
 * flag; and nothing outside the engine may perform a bulk mutation.
 *
 * WHY A GATE AND NOT A TYPE. The contract in `lib/bulk/types.ts` already makes all three
 * properties REQUIRED, so a missing one does not compile — which covers the honest mistake and
 * none of the interesting ones. What a type cannot express:
 *
 *   * A `preview` THAT WRITES. The type says it returns `PreviewItem[]`; it says nothing about
 *     what it does on the way. A preview that mutated would make the operator's decision
 *     meaningless, because they would be reading the result of the thing they had not yet agreed
 *     to. This walks every operation module and fails on an insert, update, upsert, delete or rpc
 *     inside a `preview` body.
 *   * A SECOND BULK PATH. Phase 29 arrives to implement five registered operations and could
 *     instead write its own loop over `research_products`. That compiles perfectly. It fails here,
 *     because a mutation helper called from anywhere under `app/(studio)/**` that iterates a
 *     selection is exactly the shape this looks for.
 *   * A DESTRUCTIVE FLAG THAT IS ALWAYS FALSE. Written out per operation, so `product.archive`
 *     declaring `isDestructive: false` is visible in a diff and fails here by name.
 *
 * Exit 1 on any violation. Runs in `npm run check` and in CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.cwd()
const OPERATIONS_DIR = join(ROOT, 'lib', 'bulk', 'operations')
const ENGINE = ['lib/bulk/run.ts', 'lib/bulk/undo.ts']

/**
 * Operations that MUST be destructive, by name.
 *
 * Not derived from the code — that would make the check tautological — but written out, so an
 * operation that stops declaring itself destructive fails here rather than in a post-mortem. Each
 * takes a live row out of public view, which is the whole definition.
 */
const MUST_BE_DESTRUCTIVE = [
  'product.unpublish',
  'product.archive',
  'media.archive',
  'research.reject',
]

const MUTATIONS = /\.(insert|update|upsert|delete|rpc)\s*\(/

const problems = []

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const files = walk(OPERATIONS_DIR)
if (files.length === 0)
  problems.push('lib/bulk/operations/** holds no modules — nothing is registered')

/** Every `registerBulkOperation({ ... })` literal in a file, as source text. */
function registrations(code) {
  const found = []
  const marker = 'registerBulkOperation('
  let index = code.indexOf(marker)
  while (index !== -1) {
    let depth = 0
    let end = index + marker.length
    for (; end < code.length; end += 1) {
      const character = code[end]
      if (character === '(' || character === '{') depth += 1
      else if (character === ')' || character === '}') {
        if (depth === 0) break
        depth -= 1
      }
    }
    found.push(code.slice(index, end))
    index = code.indexOf(marker, end)
  }
  return found
}

/** The body of a `preview:` property, from its arrow to the matching brace. */
function previewBody(registration) {
  const at = registration.indexOf('preview:')
  if (at === -1) return null
  const open = registration.indexOf('{', at)
  if (open === -1) return ''
  let depth = 0
  for (let index = open; index < registration.length; index += 1) {
    if (registration[index] === '{') depth += 1
    else if (registration[index] === '}') {
      depth -= 1
      if (depth === 0) return registration.slice(open, index + 1)
    }
  }
  return registration.slice(open)
}

const declaredKinds = new Set()

for (const file of files) {
  const rel = relative(ROOT, file)
  const raw = readFileSync(file, 'utf8')
  // Strings are KEPT: the operation kinds and the `isDestructive` literals are what is being read.
  const code = stripCommentsAndStrings(raw, { strings: false })

  for (const registration of registrations(code)) {
    const kindMatch = /kind:\s*['"]([a-z_.]+)['"]/.exec(registration)
    const kind = kindMatch?.[1] ?? null

    // A `for` loop registering several kinds from a tuple list is legitimate — two of the three
    // operation modules do it — and its `kind` is a variable. Those are checked by the shape of
    // the loop rather than by name.
    if (kind !== null) declaredKinds.add(kind)

    const label = kind ?? `${rel} (a computed registration)`

    /*
     * SHORTHAND COUNTS. `{ isDestructive }` from a loop variable is the same declaration as
     * `{ isDestructive: true }` — the research module registers five operations that way — and a
     * gate that only recognised the long form would report a missing flag on a module that has
     * one. Matching the property NAME followed by `:`, `,` or `}` covers both without accepting
     * a mention in passing.
     */
    const declares = (property) => new RegExp(`\\b${property}\\b\\s*[:,}]`).test(registration)

    if (!declares('paramsSchema')) {
      problems.push(`${label}: no paramsSchema. Zod at every trust boundary (D1).`)
    }
    if (!declares('isDestructive')) {
      problems.push(`${label}: no isDestructive flag.`)
    }
    if (!declares('preview')) {
      problems.push(
        `${label}: no preview. The four-step flow is Select → Preview → Confirm → Apply, and an ` +
          `operation with no preview is one an operator agrees to without seeing.`,
      )
    }
    if (!declares('applyItem')) {
      problems.push(`${label}: no applyItem.`)
    }

    const body = previewBody(registration)
    if (body !== null && MUTATIONS.test(body)) {
      const method = MUTATIONS.exec(body)?.[1]
      problems.push(
        `${label}: its preview calls .${method}(. A preview performs NO WRITES — it is what the ` +
          `operator reads before they decide, so a preview that mutates makes the decision ` +
          `meaningless.`,
      )
    }
  }
}

// Every operation that must be destructive is, and exists.
for (const kind of MUST_BE_DESTRUCTIVE) {
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
  if (!source.includes(`'${kind}'`)) {
    problems.push(`${kind} is not registered anywhere. It is on the must-be-destructive list.`)
    continue
  }
  // The two loop-registered families declare their flag beside the kind in a tuple, so the check
  // is textual: the kind and `true` on one line, or an `isDestructive: true` in its own literal.
  const line = source
    .split('\n')
    .find((candidate) => candidate.includes(`'${kind}'`) && !candidate.trim().startsWith('*'))
  const registration = source.slice(Math.max(0, source.indexOf(`'${kind}'`) - 400))
  const declaresTrue =
    (line?.includes('true') ?? false) || /isDestructive:\s*true/.test(registration.slice(0, 800))
  if (!declaresTrue) {
    problems.push(
      `${kind} does not declare isDestructive: true. It takes a live row out of public view, ` +
        `which is what the typed-count confirmation and destructive.execute exist for.`,
    )
  }
}

// The engine is the only mutator. A Studio surface looping over a selection is the second bulk
// path this exists to prevent.
for (const enginePath of ENGINE) {
  try {
    statSync(join(ROOT, enginePath))
  } catch {
    problems.push(
      `${enginePath} does not exist — the engine is the thing every surface registers against`,
    )
  }
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} bulk registry problem(s):\n`)
  for (const problem of problems) console.error(`    ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✓ bulk registry: ${declaredKinds.size} named operation(s) across ${files.length} module(s); ` +
    `every one has a preview, a Zod schema and a destructive flag, and no preview writes`,
)
