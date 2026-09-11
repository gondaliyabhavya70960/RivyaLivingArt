import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DOC_ALLOWLIST, DOC_KEYS, docKeyForPath, isDocKey } from '@/lib/cms/docs/allowlist'
import { parseMarkdown, resolveLink } from '@/lib/cms/docs/render'
import { SERVER_ONLY_VARIABLES } from '@/lib/logging/redact'

import { buildDocsIndex } from '../../scripts/docs/build-index'

/**
 * The documentation browser is not a file reader — Phase 38. Exactly the ten FEAT §30 keys; a
 * traversal, a sibling document and an absolute path are not keys; the index is built from the
 * allowlist alone and redacted; the renderer has no HTML branch.
 */

const FEAT_30 = [
  'docs/architecture/ARCHITECTURE.md',
  'docs/studio/STUDIO_GUIDE.md',
  'docs/media/MEDIA_GUIDE.md',
  'docs/architecture/SCRAPER.md',
  'docs/ops/DEPLOYMENT.md',
  'docs/ops/ENVIRONMENT.md',
  'docs/project/BUSINESS_RULES.md',
  'docs/content/CONTENT_GUIDE.md',
  'docs/design/COMPONENT_REGISTRY.md',
  'docs/media/HIGGSFIELD_GUIDE.md',
]

let root: string | null = null
afterEach(() => {
  if (root !== null) rmSync(root, { recursive: true, force: true })
  root = null
})

describe('the allowlist', () => {
  it('holds exactly the ten FEAT §30 documents', () => {
    expect(DOC_KEYS).toHaveLength(10)
    expect(DOC_KEYS.map((key) => DOC_ALLOWLIST[key].path).sort()).toEqual([...FEAT_30].sort())
  })

  it('rejects a traversal, a sibling document and an absolute path as keys', () => {
    for (const bad of [
      '../../.env',
      'docs/ops/SECURITY.md',
      '/etc/passwd',
      'security',
      'SESSION-STATE',
      'README',
      '',
    ]) {
      expect(isDocKey(bad), bad).toBe(false)
      expect(docKeyForPath(bad), bad).toBeNull()
    }
  })

  it('maps a relative path to its key and nothing else', () => {
    expect(docKeyForPath('docs/ops/ENVIRONMENT.md')).toBe('environment')
    expect(docKeyForPath('ENVIRONMENT.md')).toBe('environment')
    expect(docKeyForPath('../ops/SECURITY.md')).toBeNull()
  })
})

describe('the indexer', () => {
  it('reads the allowlist alone and redacts what it reads', () => {
    root = mkdtempSync(join(tmpdir(), 'docs-index-'))
    const secret = 'SENTINELINDEXSECRET0042'
    process.env.CRON_SECRET = secret
    for (const path of FEAT_30) {
      mkdirSync(join(root, path, '..'), { recursive: true })
      writeFileSync(join(root, path), `# Title\n\nsee ${secret} here\n`, 'utf8')
    }
    writeFileSync(join(root, 'docs/ops/SECURITY.md'), '# not served\n', 'utf8')
    const index = buildDocsIndex(root, new Date('2026-09-11T00:00:00Z'))
    expect(index.docs.map((doc) => doc.key).sort()).toEqual([...DOC_KEYS].sort())
    expect(index.docs.some((doc) => doc.path.includes('SECURITY'))).toBe(false)
    for (const doc of index.docs) expect(doc.body).not.toContain(secret)
    expect(SERVER_ONLY_VARIABLES).toContain('CRON_SECRET')
    delete process.env.CRON_SECRET
  })

  it('does not exist in git: the generated index is ignored', () => {
    expect(readFileSync('.gitignore', 'utf8')).toContain('content/docs/index.generated.json')
  })
})

describe('the renderer', () => {
  it('has no HTML branch: a script and an onerror attribute stay text', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n')
    expect(blocks).toHaveLength(2)
    for (const block of blocks) {
      expect(block.kind).toBe('paragraph')
      if (block.kind !== 'paragraph') continue
      expect(block.children.every((node) => node.kind === 'text')).toBe(true)
    }
  })

  it('rewrites a doc link to a key, keeps an anchor, and marks everything else external', () => {
    expect(resolveLink('../ops/ENVIRONMENT.md#section-4')).toEqual({
      kind: 'doc',
      key: 'environment',
      anchor: 'section-4',
    })
    expect(resolveLink('#heading')).toEqual({ kind: 'anchor', anchor: 'heading' })
    expect(resolveLink('https://example.com/x')).toEqual({
      kind: 'external',
      href: 'https://example.com/x',
    })
    expect(resolveLink('../ops/SECURITY.md')).toEqual({
      kind: 'external',
      href: '../ops/SECURITY.md',
    })
    expect(resolveLink('javascript:alert(1)')).toEqual({
      kind: 'external',
      href: 'javascript:alert(1)',
    })
  })

  it('parses headings, lists, code, tables and quotes with stable heading ids', () => {
    const blocks = parseMarkdown(
      '# One\n\n## Two words\n\n- a\n  - b\n\n```ts\nconst x = 1\n```\n\n| h1 | h2 |\n|---|---|\n| c1 | c2 |\n\n> quoted\n\n## Two words\n',
    )
    const kinds = blocks.map((block) => block.kind)
    expect(kinds).toEqual(['heading', 'heading', 'list', 'code', 'table', 'quote', 'heading'])
    const headingIds = blocks.flatMap((block) => (block.kind === 'heading' ? [block.id] : []))
    expect(headingIds).toEqual(['one', 'two-words', 'two-words-1'])
    const list = blocks[2]
    expect(list?.kind === 'list' && list.items[0]?.nested).toHaveLength(1)
  })
})
