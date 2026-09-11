#!/usr/bin/env node
/**
 * research:check-no-ml — the opportunity engine contains no machine-learned, embedded, clustered or
 * language-model-derived term. FEAT §22's prohibition on opaque scores is the design constraint,
 * and a score a researcher cannot reproduce with a pocket calculator is exactly what this refuses.
 *
 * It greps `lib/scraper/analytics/opportunity/**` (comments stripped, so a doc comment saying
 * "no embedding" does not trip it) for the vocabulary of the thing it forbids, and fails the build
 * on a hit. Proved to fail by `tests/unit/opportunity-no-ml.test.ts` against a fixture tree.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.argv[2] ?? 'lib/scraper/analytics/opportunity'
const FORBIDDEN =
  /\b(machine[\s_-]?learn\w*|embedding\w*|openai|anthropic|llm|neural|tensor\w*|onnx|pgvector|kmeans|k-means|cluster\w*)\b/iu

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx|mjs|js)$/u.test(entry) && !/\.test\./u.test(entry)) out.push(full)
  }
  return out
}

const problems = []
for (const file of walk(ROOT)) {
  const source = stripCommentsAndStrings(readFileSync(file, 'utf8'), { strings: false })
  const lines = source.split('\n')
  lines.forEach((line, index) => {
    const match = FORBIDDEN.exec(line)
    if (match) problems.push(`${file}:${String(index + 1)}: ${match[0]}`)
  })
}

if (problems.length > 0) {
  console.error('opportunity engine names a learned or opaque term:\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log(`✓ no learned term under ${ROOT}: the score is a weighted mean a person can recompute`)
