import { docKeyForPath, isDocKey, type DocKey } from './allowlist'

/**
 * Markdown → a small block tree — Phase 38. No raw HTML, ever: the parser has no HTML branch, so
 * `<script>` and `onerror=` arrive as text and leave as text (the renderer escapes by being React).
 * Headings, paragraphs, lists (two levels), fenced code, blockquotes, tables, rules, and inline
 * code, emphasis and links. Enough for the ten guides; anything the parser does not recognise is
 * rendered as a paragraph of its own text rather than dropped.
 *
 * LINKS ARE REWRITTEN, NOT TRUSTED. A relative link to one of the ten documents becomes an in-app
 * doc key; a `#fragment` stays an anchor on the page; anything else is EXTERNAL — shown as text,
 * unclickable inside the browser (STUDIO_GUIDE §13.11).
 */

export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'strong'; readonly children: readonly Inline[] }
  | { readonly kind: 'em'; readonly children: readonly Inline[] }
  | { readonly kind: 'link'; readonly target: LinkTarget; readonly children: readonly Inline[] }

export type LinkTarget =
  | { readonly kind: 'doc'; readonly key: DocKey; readonly anchor: string | null }
  | { readonly kind: 'anchor'; readonly anchor: string }
  | { readonly kind: 'external'; readonly href: string }

export type Block =
  | {
      readonly kind: 'heading'
      readonly level: 1 | 2 | 3 | 4 | 5 | 6
      readonly id: string
      readonly children: readonly Inline[]
    }
  | { readonly kind: 'paragraph'; readonly children: readonly Inline[] }
  | { readonly kind: 'code'; readonly language: string | null; readonly text: string }
  | { readonly kind: 'quote'; readonly children: readonly Inline[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly ListItem[] }
  | {
      readonly kind: 'table'
      readonly header: readonly (readonly Inline[])[]
      readonly rows: readonly (readonly Inline[])[][]
    }
  | { readonly kind: 'rule' }

export interface ListItem {
  readonly children: readonly Inline[]
  readonly nested: readonly ListItem[]
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/gu, '')
    .replace(/[^a-z0-9\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
    .slice(0, 80)
}

export function resolveLink(href: string): LinkTarget {
  const trimmed = href.trim()
  if (trimmed.startsWith('#')) return { kind: 'anchor', anchor: trimmed.slice(1) }
  if (/^[a-z]+:/iu.test(trimmed) || trimmed.startsWith('//')) {
    return { kind: 'external', href: trimmed }
  }
  const [pathPart, anchor] = trimmed.split('#', 2)
  const cleaned = (pathPart ?? '').replace(/^(\.\.\/)+/u, '').replace(/^\.\//u, '')
  const key = docKeyForPath(cleaned)
  if (key !== null) return { kind: 'doc', key, anchor: anchor ?? null }
  if (isDocKey(cleaned)) return { kind: 'doc', key: cleaned, anchor: anchor ?? null }
  return { kind: 'external', href: trimmed }
}

const INLINE_TOKEN =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/u

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let rest = text
  while (rest.length > 0) {
    const match = INLINE_TOKEN.exec(rest)
    if (match === null || match.index === undefined) {
      out.push({ kind: 'text', text: rest })
      break
    }
    if (match.index > 0) out.push({ kind: 'text', text: rest.slice(0, match.index) })
    const token = match[0]
    if (token.startsWith('`')) {
      out.push({ kind: 'code', text: token.slice(1, -1) })
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push({ kind: 'strong', children: parseInline(token.slice(2, -2)) })
    } else if (token.startsWith('[')) {
      const close = token.indexOf('](')
      const label = token.slice(1, close)
      const href = token.slice(close + 2, -1)
      out.push({ kind: 'link', target: resolveLink(href), children: parseInline(label) })
    } else {
      out.push({ kind: 'em', children: parseInline(token.slice(1, -1)) })
    }
    rest = rest.slice(match.index + token.length)
  }
  return out
}

function inlineText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => {
      switch (inline.kind) {
        case 'text':
        case 'code':
          return inline.text
        default:
          return inlineText(inline.children)
      }
    })
    .join('')
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/u, '').replace(/\|$/u, '')
  return trimmed.split(/(?<!\\)\|/u).map((cell) => cell.trim().replace(/\\\|/gu, '|'))
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/u.test(line)
}

function listMarker(line: string): { indent: number; ordered: boolean; text: string } | null {
  const match = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/u.exec(line)
  if (match === null) return null
  return { indent: (match[1] ?? '').length, ordered: match[3] !== undefined, text: match[4] ?? '' }
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/gu, '\n').split('\n')
  const blocks: Block[] = []
  const seenIds = new Map<string, number>()
  let i = 0

  const uniqueId = (text: string): string => {
    const base = slugifyHeading(text) || 'section'
    const seen = seenIds.get(base) ?? 0
    seenIds.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${String(seen)}`
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() === '') {
      i += 1
      continue
    }

    // Fenced code.
    const fence = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*$/u.exec(line)
    if (fence !== null) {
      const marker = fence[2] ?? '```'
      const language = fence[3] === undefined || fence[3] === '' ? null : fence[3]
      const body: string[] = []
      i += 1
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith(marker.slice(0, 3))) {
        body.push(lines[i] ?? '')
        i += 1
      }
      i += 1
      blocks.push({ kind: 'code', language, text: body.join('\n') })
      continue
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/u.exec(line)
    if (heading !== null) {
      const level = Math.min(6, (heading[1] ?? '#').length) as 1 | 2 | 3 | 4 | 5 | 6
      const children = parseInline(heading[2] ?? '')
      blocks.push({ kind: 'heading', level, id: uniqueId(inlineText(children)), children })
      i += 1
      continue
    }

    // Rule.
    if (/^\s*([-*_])(\s*\1){2,}\s*$/u.test(line)) {
      blocks.push({ kind: 'rule' })
      i += 1
      continue
    }

    // Blockquote.
    if (/^\s*>/u.test(line)) {
      const quoted: string[] = []
      while (i < lines.length && /^\s*>/u.test(lines[i] ?? '')) {
        quoted.push((lines[i] ?? '').replace(/^\s*>\s?/u, ''))
        i += 1
      }
      blocks.push({ kind: 'quote', children: parseInline(quoted.join(' ')) })
      continue
    }

    // Table: a header row followed by a separator row.
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? '')) {
      const header = splitTableRow(line).map(parseInline)
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim() !== '') {
        rows.push(splitTableRow(lines[i] ?? '').map(parseInline))
        i += 1
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    // List, two levels by indentation.
    const marker = listMarker(line)
    if (marker !== null) {
      const items: { children: Inline[]; nested: ListItem[] }[] = []
      const ordered = marker.ordered
      const baseIndent = marker.indent
      while (i < lines.length) {
        const current = lines[i] ?? ''
        const m = listMarker(current)
        if (m === null) {
          // A continuation line belongs to the last item.
          if (current.trim() !== '' && /^\s{2,}/u.test(current) && items.length > 0) {
            const last = items[items.length - 1]
            if (last !== undefined) {
              last.children = [
                ...last.children,
                { kind: 'text', text: ' ' },
                ...parseInline(current.trim()),
              ]
            }
            i += 1
            continue
          }
          break
        }
        if (m.indent > baseIndent && items.length > 0) {
          const last = items[items.length - 1]
          if (last !== undefined)
            last.nested = [...last.nested, { children: parseInline(m.text), nested: [] }]
        } else if (m.indent === baseIndent) {
          items.push({ children: parseInline(m.text), nested: [] })
        } else {
          break
        }
        i += 1
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }

    // Paragraph: run to the next blank line or block start.
    const paragraph: string[] = []
    while (i < lines.length) {
      const current = lines[i] ?? ''
      if (current.trim() === '') break
      if (/^(#{1,6}\s|\s*(`{3,}|~{3,})|\s*>)/u.test(current)) break
      if (listMarker(current) !== null) break
      if (current.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? ''))
        break
      paragraph.push(current.trim())
      i += 1
    }
    blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join(' ')) })
  }

  return blocks
}

/** Every heading's id and text, for a table of contents. */
export function headings(
  blocks: readonly Block[],
): readonly { id: string; level: number; text: string }[] {
  return blocks.flatMap((block) =>
    block.kind === 'heading'
      ? [{ id: block.id, level: block.level, text: inlineText(block.children) }]
      : [],
  )
}
