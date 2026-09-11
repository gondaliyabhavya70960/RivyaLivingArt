#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { DOC_ALLOWLIST, DOC_KEYS, DOCS_INDEX_PATH } from '../../lib/cms/docs/allowlist'
import { redactString } from '../../lib/logging/redact'

/**
 * `npm run docs:index` — Phase 38. Reads exactly the ten allowlisted paths, runs each body through
 * the redactor, and writes `content/docs/index.generated.json`. No directory walk: a document not
 * named in `lib/cms/docs/allowlist.ts` cannot be indexed by any argument to this script.
 */

export interface BuiltIndex {
  readonly generatedAt: string
  readonly docs: readonly { key: string; title: string; path: string; body: string }[]
}

export function buildDocsIndex(root: string, now: Date = new Date()): BuiltIndex {
  return {
    generatedAt: now.toISOString(),
    docs: DOC_KEYS.map((key) => {
      const entry = DOC_ALLOWLIST[key]
      const body = readFileSync(join(root, entry.path), 'utf8')
      return { key, title: entry.title, path: entry.path, body: redactString(body) }
    }),
  }
}

function main(): void {
  const root = process.cwd()
  const index = buildDocsIndex(root)
  const target = join(root, DOCS_INDEX_PATH)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(index), 'utf8')
  console.log(`✓ ${DOCS_INDEX_PATH}: ${String(index.docs.length)} documents indexed and redacted`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
