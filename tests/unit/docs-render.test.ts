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

  it('renders no front-matter BLOCK on any of the ten allowlisted documents', () => {
    /*
     * THE ASSERTION IS THE BLOCK'S SIGNATURE, NOT A SUBSTRING — corrected when this test failed on a
     * correct page.
     *
     * It used to search the rendered output for `owner_verification:` anywhere. That caught the
     * defect, and it also caught the Studio guide the moment Phase 46 added a sentence EXPLAINING
     * that its front matter reads `owner_verification: OWNER_VERIFICATION_REQUIRED` — prose inside a
     * code span, in the body, exactly where it belongs. A documentation set is entitled to document
     * its own conventions, and a gate that forbids a document from naming a key is a gate that will
     * be deleted the first time somebody needs to write about front matter.
     *
     * What actually goes wrong is a whole BLOCK of `key: value` lines rendered as one paragraph,
     * which is what the unstripped fence produces. So the signature is what this looks for: a single
     * text block carrying several of the five keys at once. One key in a sentence is prose; four
     * keys in one paragraph is the metadata block.
     */
    const KEYS = ['doc:', 'status:', 'owning_phase:', 'last_reviewed:', 'owner_verification:']

    for (const key of DOC_KEYS) {
      const blocks = parseMarkdown(readFileSync(DOC_ALLOWLIST[key].path, 'utf8'))

      for (const block of blocks) {
        const text = JSON.stringify(block)
        const present = KEYS.filter((metadataKey) => text.includes(metadataKey)).length
        expect(
          present,
          `${key} renders a block carrying ${String(present)} of the five front-matter keys, which is the front matter itself`,
        ).toBeLessThan(3)
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
