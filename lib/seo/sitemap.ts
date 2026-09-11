/**
 * The split sitemap — PHASE-39-46 §Phase 39: an index over six children, each listing PUBLISHED
 * rows only, `lastmod` from `published_at` falling back to `updated_at`, at most 5 000 URLs per
 * file. **No `priority`, no `changefreq`** — both are ignored by the major engines and both invite
 * a fabricated freshness signal. **No image sitemap** — every image the site holds today is a
 * concept render (`is_concept = true`), and an image sitemap would invite Google Images to surface
 * AI concept visualisations as Rivya's products (D6, D10).
 *
 * PURE. The route handlers read rows through `lib/supabase/repositories/sitemap.ts` and hand them
 * here; a unit test states every rule without a database.
 */

export const SITEMAP_TYPES = [
  'pages',
  'categories',
  'products',
  'collections',
  'portfolio',
  'journal',
] as const
export type SitemapType = (typeof SITEMAP_TYPES)[number]

export function isSitemapType(value: string): value is SitemapType {
  return (SITEMAP_TYPES as readonly string[]).includes(value)
}

/** The phase document's cap. A seventh thousand goes in the next file, not the same one. */
export const MAX_URLS_PER_FILE = 5000

export type SitemapRow = {
  readonly path: string
  readonly status: string
  readonly publishedAt: string | null
  readonly updatedAt: string
}

export type SitemapEntry = {
  readonly loc: string
  readonly lastModified: string
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * PUBLISHED rows only, as absolute URLs. The anonymous client already filters by RLS; the status
 * check here is the belt to that braces, so a row a policy let through by mistake still cannot
 * reach a crawler. `lastmod` is the publish time when there is one — what changed for a reader —
 * and the row's last update otherwise.
 */
export function sitemapEntries(
  rows: readonly SitemapRow[],
  origin: string,
): readonly SitemapEntry[] {
  const seen = new Set<string>()
  const entries: SitemapEntry[] = []
  for (const row of rows) {
    if (row.status !== 'PUBLISHED') continue
    const loc = new URL(row.path, origin).toString()
    if (seen.has(loc)) continue
    seen.add(loc)
    entries.push({ loc, lastModified: row.publishedAt ?? row.updatedAt })
    if (entries.length >= MAX_URLS_PER_FILE) break
  }
  return entries
}

export function urlsetXml(entries: readonly SitemapEntry[]): string {
  const body = entries
    .map(
      (entry) =>
        `  <url><loc>${escapeXml(entry.loc)}</loc><lastmod>${escapeXml(
          new Date(entry.lastModified).toISOString(),
        )}</lastmod></url>`,
    )
    .join('\n')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    (body === '' ? '' : '\n') +
    '</urlset>\n'
  )
}

/** The child files, as the index announces them: `/sitemaps/<type>.xml`. */
export function sitemapChildPath(type: SitemapType): string {
  return `/sitemaps/${type}.xml`
}

export function sitemapIndexXml(
  origin: string,
  types: readonly SitemapType[] = SITEMAP_TYPES,
): string {
  const body = types
    .map(
      (type) =>
        `  <sitemap><loc>${escapeXml(new URL(sitemapChildPath(type), origin).toString())}</loc></sitemap>`,
    )
    .join('\n')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</sitemapindex>\n'
  )
}
