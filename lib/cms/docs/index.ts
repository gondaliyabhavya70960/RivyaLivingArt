import 'server-only'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cache } from 'react'
import { z } from 'zod'

import { DOC_KEYS, DOCS_INDEX_PATH, type DocKey } from './allowlist'

/**
 * The generated index, read once per request — Phase 38. Written by `npm run docs:index` (the
 * `prebuild` step) from the ten allowlisted paths, each body redacted at build time. Absent (a
 * dev server started without the step), the browser says so rather than reading `docs/` — the
 * production runtime has no docs directory to traverse, by design.
 */

export const docsIndexSchema = z.object({
  generatedAt: z.string(),
  docs: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      path: z.string(),
      body: z.string(),
    }),
  ),
})
export type DocsIndex = z.infer<typeof docsIndexSchema>
export type IndexedDoc = DocsIndex['docs'][number]

export const readDocsIndex = cache((): DocsIndex | null => {
  try {
    const raw = readFileSync(join(process.cwd(), DOCS_INDEX_PATH), 'utf8')
    const parsed = docsIndexSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    // Only the allowlisted keys are served, whatever the file holds.
    return {
      generatedAt: parsed.data.generatedAt,
      docs: parsed.data.docs.filter((doc) => (DOC_KEYS as readonly string[]).includes(doc.key)),
    }
  } catch {
    return null
  }
})

export function getIndexedDoc(key: DocKey): IndexedDoc | null {
  const index = readDocsIndex()
  return index?.docs.find((doc) => doc.key === key) ?? null
}
