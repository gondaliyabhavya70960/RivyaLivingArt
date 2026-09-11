/**
 * The four-level metadata resolution ladder — PHASE-39-46 §Phase 39, first hit wins:
 *
 *   ENTITY   a `seo_entries` row of scope ENTITY for exactly this entity, or the entity's own
 *            SEO columns (`products.seo_title`, `categories.seo_description` …) — both are words
 *            an owner typed for this one thing
 *   PATH     a `seo_entries` row of scope PATH for exactly this path
 *   DERIVED  computed from the page's own published content, by the one dumb rule below
 *   GLOBAL   the single `seo_entries` row of scope GLOBAL
 *
 * PURE, AND PER FIELD. The ladder is climbed once per field rather than once per page, because a
 * path row that carries a title and no description should lend its title and let the description
 * come from further down — not force the page to a level that has nothing to say. Every resolved
 * field carries the level it came from, and that level is what the Studio prints beside it, so an
 * editor can always tell their own words from a default.
 *
 * DERIVATION IS DELIBERATELY DUMB AND STATED ONCE. Title = the page's first `heading`; description
 * = the first 155 characters of the first `body`, cut on a word boundary. It never invents a
 * sentence, never concatenates two sections, and never reaches for an eyebrow or a CTA to fill a
 * gap. A derived value is a default the owner has not yet replaced, and the Coverage tab counts it
 * as exactly that.
 *
 * NOTHING HERE READS A DATABASE. The callers (`lib/seo/metadata.ts` on the public site, the SEO
 * workspace in the Studio) fetch the rows; this module decides.
 */

export const SEO_LEVELS = ['ENTITY', 'PATH', 'DERIVED', 'GLOBAL', 'NONE'] as const
export type SeoLevel = (typeof SEO_LEVELS)[number]

/** The 155-character mark the phase document names for a derived description. */
export const DERIVED_DESCRIPTION_LENGTH = 155

/** The columns of a `seo_entries` row the ladder reads. Typed structurally so a test needs no row. */
export type SeoEntryLike = {
  readonly title: string | null
  readonly description: string | null
  readonly social_title: string | null
  readonly social_description: string | null
  readonly og_media_id: string | null
  readonly canonical_url: string | null
  readonly robots: string | null
  readonly noindex: boolean
  readonly nofollow: boolean
}

/** An entity's own SEO columns — the words typed on the product itself, before any entry row. */
export type EntityOwnSeo = {
  readonly title?: string | null
  readonly description?: string | null
  readonly ogMediaId?: string | null
}

export type DerivedSeo = {
  readonly title: string | null
  readonly description: string | null
}

export type SeoLadder = {
  readonly entity?: SeoEntryLike | null
  readonly entityOwn?: EntityOwnSeo | null
  readonly path?: SeoEntryLike | null
  readonly derived?: DerivedSeo | null
  readonly global?: SeoEntryLike | null
}

export type Resolved<T> = {
  readonly value: T
  /** Where the value came from. `NONE` means every rung was empty and `value` is null. */
  readonly level: SeoLevel
}

export type ResolvedSeo = {
  readonly title: Resolved<string | null>
  readonly description: Resolved<string | null>
  readonly socialTitle: Resolved<string | null>
  readonly socialDescription: Resolved<string | null>
  readonly ogMediaId: Resolved<string | null>
  /** ENTITY or PATH only: a canonical is a statement about one address, never a site default. */
  readonly canonicalUrl: Resolved<string | null>
  readonly noindex: boolean
  readonly nofollow: boolean
  /** The rung whose directive was taken. `NONE` when no row said anything, i.e. index, follow. */
  readonly robotsLevel: SeoLevel
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

function climb(rungs: readonly [SeoLevel, string | null | undefined][]): Resolved<string | null> {
  for (const [level, raw] of rungs) {
    const value = nonEmpty(raw)
    if (value !== null) return { value, level }
  }
  return { value: null, level: 'NONE' }
}

/**
 * The legacy `robots` string, kept for the rows that carry one. `noindex,follow` and the three
 * other allowed values (`seo_entries_robots_allowed`) read into the two booleans.
 */
function directiveOf(row: SeoEntryLike): { noindex: boolean; nofollow: boolean } | null {
  const legacy = nonEmpty(row.robots)?.toLowerCase() ?? null
  const fromLegacy =
    legacy === null
      ? null
      : {
          noindex: legacy.includes('noindex'),
          nofollow: legacy.includes('nofollow'),
        }
  if (row.noindex || row.nofollow) {
    return {
      noindex: row.noindex || (fromLegacy?.noindex ?? false),
      nofollow: row.nofollow || (fromLegacy?.nofollow ?? false),
    }
  }
  return fromLegacy
}

export function resolveSeo(ladder: SeoLadder): ResolvedSeo {
  const entity = ladder.entity ?? null
  const own = ladder.entityOwn ?? null
  const path = ladder.path ?? null
  const derived = ladder.derived ?? null
  const global = ladder.global ?? null

  const title = climb([
    ['ENTITY', entity?.title],
    ['ENTITY', own?.title],
    ['PATH', path?.title],
    ['DERIVED', derived?.title],
    ['GLOBAL', global?.title],
  ])
  const description = climb([
    ['ENTITY', entity?.description],
    ['ENTITY', own?.description],
    ['PATH', path?.description],
    ['DERIVED', derived?.description],
    ['GLOBAL', global?.description],
  ])
  // A social title falls back to the resolved title of the same page before it falls back to the
  // site's social default: the card for /about should say "About", not the brand's strapline.
  const socialTitle = climb([
    ['ENTITY', entity?.social_title],
    ['PATH', path?.social_title],
    [title.level, title.level === 'GLOBAL' ? null : title.value],
    ['GLOBAL', global?.social_title],
    ['GLOBAL', global?.title],
  ])
  const socialDescription = climb([
    ['ENTITY', entity?.social_description],
    ['PATH', path?.social_description],
    [description.level, description.level === 'GLOBAL' ? null : description.value],
    ['GLOBAL', global?.social_description],
    ['GLOBAL', global?.description],
  ])
  const ogMediaId = climb([
    ['ENTITY', entity?.og_media_id],
    ['ENTITY', own?.ogMediaId],
    ['PATH', path?.og_media_id],
    ['GLOBAL', global?.og_media_id],
  ])
  const canonicalUrl = climb([
    ['ENTITY', entity?.canonical_url],
    ['PATH', path?.canonical_url],
  ])

  // The directive is taken whole from the first rung that states one. Half a directive from one
  // row and half from another would produce a combination nobody chose.
  const directives: readonly [SeoLevel, SeoEntryLike | null][] = [
    ['ENTITY', entity],
    ['PATH', path],
    ['GLOBAL', global],
  ]
  let robots: { noindex: boolean; nofollow: boolean; level: SeoLevel } = {
    noindex: false,
    nofollow: false,
    level: 'NONE',
  }
  for (const [level, row] of directives) {
    if (row === null) continue
    const directive = directiveOf(row)
    if (directive !== null) {
      robots = { ...directive, level }
      break
    }
  }

  return {
    title,
    description,
    socialTitle,
    socialDescription,
    ogMediaId,
    canonicalUrl,
    noindex: robots.noindex,
    nofollow: robots.nofollow,
    robotsLevel: robots.level,
  }
}

/**
 * Cut `text` to at most `max` characters on a word boundary. No ellipsis: an ellipsis in a
 * description tells a reader the sentence was cut, which is true, and tells a crawler nothing;
 * the phase document asks for the first 155 characters and nothing appended.
 */
export function truncateAtWord(text: string, max: number = DERIVED_DESCRIPTION_LENGTH): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= max) return collapsed
  // One past the mark, so a word that ends exactly at the mark is kept whole.
  const head = collapsed.slice(0, max + 1)
  const lastSpace = head.lastIndexOf(' ')
  // A single 155-character word has no boundary to cut on; the hard cut is the only honest one.
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : head.slice(0, max)
  return cut.replace(/[\s,;:—–-]+$/u, '')
}

/**
 * The DERIVED rung, from a page's live sections in position order.
 *
 * FIRST HEADING, FIRST BODY — and "first" means the first section that HAS one, which need not be
 * the same section. A hero with a heading and no body followed by a manifesto with a body gives
 * the hero's heading and the manifesto's opening; that is still one heading and one body, not a
 * concatenation. Markdown emphasis is stripped from the body so a description never opens with
 * an asterisk.
 */
export function deriveSeo(
  sections: readonly { readonly heading: string | null; readonly body: string | null }[],
): DerivedSeo {
  let title: string | null = null
  let description: string | null = null
  for (const section of sections) {
    if (title === null) title = nonEmpty(section.heading)
    if (description === null) {
      const body = nonEmpty(section.body)
      if (body !== null) {
        description = truncateAtWord(body.replace(/[*_`#>]+/g, ''))
      }
    }
    if (title !== null && description !== null) break
  }
  return { title, description }
}

/** The DERIVED rung for an entity route: its own name and summary, cut by the same rule. */
export function deriveEntitySeo(input: {
  readonly name: string | null | undefined
  readonly summary: string | null | undefined
}): DerivedSeo {
  const summary = nonEmpty(input.summary)
  return {
    title: nonEmpty(input.name),
    description: summary === null ? null : truncateAtWord(summary.replace(/[*_`#>]+/g, '')),
  }
}
