import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DOC_ALLOWLIST, DOC_KEYS } from '@/lib/cms/docs/allowlist'
import { parseMarkdown } from '@/lib/cms/docs/render'

/**
 * FRONT MATTER IS METADATA, AND THE VIEWER MUST NOT SHOW IT — Phase 46.
 *
 * Phase 01 gave every document under `docs/` a five-key front-matter block so its status is
 * machine-readable. Phase 38 built the Studio's documentation viewer with a parser that has no
 * front-matter branch: it read the opening `---` as a horizontal rule and the five `key: value`
 * lines as a paragraph. So the Studio guide opened on a rule and the words
 * "doc: STUDIO_GUIDE status: CURRENT owning_phase: 05 …", on seven of the ten allowlisted documents.
 *
 * Phase 46 gave the remaining three documents front matter — which would have made it ten out of ten
 * — and taught the parser to drop the block. These tests hold both halves of that: the parser's
 * behaviour on the shapes that matter, and the invariant across the real ten, so a document added to
 * the allowlist later cannot reintroduce the defect.
 */

const FRONT_MATTER = [
  '---',
  'doc: STUDIO_GUIDE',
  'status: CURRENT',
  'owning_phase: 05',
  'last_reviewed: 2026-09-12',
  'owner_verification: NOT_REQUIRED',
  '---',
].join('\n')

describe('the documentation parser, on front matter', () => {
  it('drops the block and opens on the document’s own first heading', () => {
    const blocks = parseMarkdown(`${FRONT_MATTER}\n\n# Studio guide\n\nThe first paragraph.\n`)

    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 })
    // The defect's signature: a rule first, then a paragraph carrying the metadata.
    expect(blocks.map((block) => block.kind)).not.toContain('rule')
    expect(JSON.stringify(blocks)).not.toContain('owning_phase')
  })

  it('keeps a horizontal rule that is the document’s actual first block', () => {
    /*
     * The narrow reading matters. A fence only opens front matter on the VERY first line, so a
     * document that genuinely starts with a rule keeps it — otherwise this function would silently
     * eat real content to fix a metadata problem.
     */
    const blocks = parseMarkdown('---\n\n# Heading after a rule\n')

    expect(blocks[0]).toMatchObject({ kind: 'rule' })
  })

  it('leaves an unterminated fence entirely alone rather than swallowing the document', () => {
    /*
     * The greedy version of this function returns an empty page when the closing fence is missing,
     * and a blank document is a worse failure than a visible metadata block: one is obviously wrong
     * and one looks like the document has no content.
     */
    const blocks = parseMarkdown('---\ndoc: BROKEN\n\n# Still here\n')

    expect(blocks.length).toBeGreaterThan(0)
    expect(JSON.stringify(blocks)).toContain('Still here')
  })

  it('shows no metadata key on any of the ten allowlisted documents', () => {
    // The invariant, asserted against the real files rather than a fixture: whatever the ten are
    // today, none of them may render its front matter as content.
    for (const key of DOC_KEYS) {
      const body = readFileSync(DOC_ALLOWLIST[key].path, 'utf8')
      const rendered = JSON.stringify(parseMarkdown(body))

      for (const metadataKey of ['owning_phase', 'last_reviewed', 'owner_verification']) {
        expect(rendered, `${key} renders its front matter as page content`).not.toContain(
          `${metadataKey}:`,
        )
      }
    }
  })

  it('gives every allowlisted document front matter to drop', () => {
    /*
     * The other half of the Phase 46 fix. A document with no front matter is outside the Phase 01
     * contract that `scripts/docs/audit-docs.mjs` enforces, and six of these ten were outside it
     * until this phase — including the binding contract's own neighbours.
     */
    for (const key of DOC_KEYS) {
      const first = readFileSync(DOC_ALLOWLIST[key].path, 'utf8').split('\n')[0]
      expect(first, `${DOC_ALLOWLIST[key].path} has no front matter`).toBe('---')
    }
  })
})
