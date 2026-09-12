import { z } from 'zod'

import { factClassificationSchema } from '../supabase/schemas/common'

import type { Enums, TableName } from '../supabase/database.types'

/**
 * THE OWNER-VERIFICATION BACKLOG, DECLARED ONCE — Phase 46.
 *
 * Twenty-two tables carry an `owner_verification` column, and a row set to
 * `OWNER_VERIFICATION_REQUIRED` is a seeded sentence, detail or binding that ASSERTS SOMETHING
 * ABOUT A REAL BUSINESS and that nobody at Rivya has confirmed yet. D10 says only the owner can
 * confirm it. This file is the single declaration of where such rows live, what a human calls
 * them, which Studio screen resolves them, and what the owner is actually being asked.
 *
 * WHY IT IS DECLARED HERE AND NOT IN THE GENERATOR. Two readers need the same answer and they
 * reach the database through different doors:
 *
 *   scripts/content/build-verification-report.ts  reads with `pg` (a script, no session) and needs
 *                                                 every ROW, to write the handover document;
 *   lib/supabase/repositories/verifications.ts     reads through PostgREST as the signed-in user
 *                                                 and needs the COUNT, for the `/studio` card.
 *
 * Two independent implementations of "how many verifications are outstanding" would disagree the
 * first time one of them changed, and the owner would be looking at a card that contradicts the
 * document it links to. So the SURFACES are declared once, here; the SQL text is built from them
 * for the `pg` reader; and the PostgREST reader is type-bound to the same list.
 *
 * IT HOLDS SQL TEXT AND NO CLIENT. Nothing here connects to anything, so this module is safe to
 * import from a script, from a Server Component and from a unit test alike. Every fragment is a
 * constant declared in this file — no value is ever interpolated into the SQL from a row, a request
 * or an argument, which is the only reason building a statement as a string is defensible at all.
 *
 * EVERY TABLE NAME IS A QUOTED STRING, NEVER A BARE PROPERTY KEY. `lib/cms/` is a public tree to
 * the research isolation gate (I3, scripts/research/check-research-isolation.mjs), which refuses
 * any `research_` identifier there and strips string literals before it looks. The briefs table is
 * named below as a string for exactly that reason; written as an object key it would fail the gate,
 * correctly, because a bare identifier is the shape that leaks into a public render.
 */

/** The one flag value this whole file is about. */
export const OWNER_VERIFICATION_REQUIRED: Enums<'owner_verification'> =
  'OWNER_VERIFICATION_REQUIRED'

/**
 * The tables carrying the column, as literals the generated `Database` type must still recognise.
 *
 * `Extract` rather than a free union: if a migration renames or drops one of these, the name stops
 * being a member of `TableName`, `Extract` drops it, and the surface declared for it below no
 * longer type-checks. The alternative — a bare string union — would compile happily against a
 * table that no longer exists and fail in front of the owner at generation time.
 *
 * The generator ALSO asks the database for the real list and refuses to write when the two differ,
 * because a table that GAINS the column is invisible to the compiler: see
 * `VERIFICATION_TABLES_SQL`.
 */
export type VerificationTable = Extract<
  TableName,
  | 'categories'
  | 'collections'
  | 'customization_forms'
  | 'faqs'
  | 'global_content'
  | 'journal_articles'
  | 'journal_categories'
  | 'materials'
  | 'media_assets'
  | 'model_variant_labels'
  | 'navigation_items'
  | 'page_sections'
  | 'pages'
  | 'portfolio_projects'
  | 'product_attribute_terms'
  | 'product_specs'
  | 'products'
  | 'research_direction_briefs'
  | 'seo_entries'
  | 'seo_keyword_themes'
  | 'seo_redirects'
  | 'testimonials'
>

/**
 * One surface — a table, how to describe its flagged rows to a non-technical reader, and where the
 * owner goes to clear them.
 *
 * `identifierSql`, `qualifierSql`, `sortSql`, `join` and `studioSql` are SQL EXPRESSION FRAGMENTS,
 * evaluated against the flagged table aliased `t`. They are declarations of shape, not values:
 * nothing a row contains ever becomes part of the statement.
 */
export interface VerificationSurface {
  readonly table: VerificationTable
  /** The group heading. `surfaceSql`, where present, overrides it per row. */
  readonly surface: string
  /** Derives the group from the row instead, for the one surface whose group is the page. */
  readonly surfaceSql?: string
  /** The Studio screen that resolves a row here, or `null` when no screen edits this table. */
  readonly studio: string | null
  /** Says why there is no screen. Required whenever `studio` is null — it is a handover fact. */
  readonly noStudioScreen?: string
  /** Derives the path from the row, where the screen is addressed by something stable (a slug). */
  readonly studioSql?: string
  /** What a non-technical owner will recognise this row by. */
  readonly identifierSql: string
  /** A second column feeding the confirmation sentence (a `group_key`, a `menu`, a `kind`). */
  readonly qualifierSql: string
  /** Deterministic ordering within the group. The document is committed and diffed. */
  readonly sortSql: string
  /** `false` for the one child table with no publication status of its own. */
  readonly hasStatus: boolean
  /** Extra `from` clauses the expressions above need. */
  readonly join?: string
  /** What the owner must confirm. One sentence, completing "Confirm …". */
  readonly confirm: string
  /** Overrides keyed by the row's own `fact_classification`. */
  readonly confirmByClassification?: Partial<Record<Enums<'fact_classification'>, string>>
  /** Overrides keyed by the row's `qualifierSql` value, exactly matched. */
  readonly confirmByQualifier?: Partial<Record<string, string>>
  /** Group ordering. Content first, catalogue next, internal last — an owner's reading order. */
  readonly rank: number
}

/**
 * WHAT THE OWNER MUST CONFIRM IS DERIVED, NEVER WRITTEN PER ROW.
 *
 * The sentences below are the hardest part of this file and the easiest place to fabricate. A
 * per-row column would invite whoever regenerates the document to explain what a given sentence
 * MEANS — and an explanation of a claim nobody has verified is itself an unverified claim. So the
 * question is derived from the table the row is in and, where the table mixes kinds, from the row's
 * own `fact_classification` or grouping column. Every sentence asks the owner about RIVYA; none
 * asserts anything about Rivya.
 */
export const VERIFICATION_SURFACES: readonly VerificationSurface[] = [
  {
    table: 'pages',
    surface: 'Pages',
    studio: '/studio/content/pages',
    studioSql: "'/studio/content/pages/' || t.slug",
    identifierSql: "coalesce(nullif(t.title, ''), t.slug)",
    qualifierSql: 't.kind::text',
    sortSql: 'coalesce(t.path, t.slug)',
    hasStatus: true,
    confirm: 'that this page belongs on Rivya’s website, at this address, under this title.',
    rank: 10,
  },
  {
    /*
     * THE ONE SURFACE THAT IS NOT A TABLE BUT A PAGE. A section's group is the page it sits on,
     * because that is how an owner works: they open `/process`, read the seven steps, and confirm
     * or correct them in one sitting. Grouping twenty sections under "Page sections" would hand
     * them a list they have to re-sort by hand.
     */
    table: 'page_sections',
    surface: 'Page sections',
    surfaceSql: "'Page ' || coalesce(p.path, p.title)",
    studio: '/studio/content/pages',
    studioSql: "'/studio/content/pages/' || p.slug",
    identifierSql:
      "coalesce(nullif(t.heading, ''), nullif(t.eyebrow, ''), t.block_type) ||" +
      " coalesce(' · ' || replace(t.seed_key, 'section:', ''), '')",
    qualifierSql: "coalesce(replace(t.seed_key, 'section:', ''), t.block_type)",
    // The path, then the position within the page, zero-padded so 10 sorts after 9.
    sortSql: "coalesce(p.path, p.title) || ':' || lpad(t.position::text, 4, '0')",
    hasStatus: true,
    join: 'join pages p on p.id = t.page_id',
    confirm: 'that Rivya can do what this section describes, and that these are Rivya’s own words.',
    confirmByClassification: {
      VERIFIED_BUSINESS_FACT:
        'that every detail stated here — a number, an address, a name — is Rivya’s own and current.',
      PRODUCT_FACT: 'that this describes a real piece accurately.',
      LEGAL_COPY: 'that this is the wording Rivya stands behind.',
      SEO_COPY: 'that this describes work Rivya actually does.',
      EDITORIAL_COPY: 'that what this says about Rivya’s work is true.',
    },
    rank: 11,
  },
  {
    table: 'global_content',
    // The reserved SYSTEM page. `resolveStudioPage` accepts the slug `global`, which is what this
    // screen is for — see lib/cms/resolve.ts.
    surface: 'Site-wide content',
    studio: '/studio/content/pages/global',
    identifierSql: "coalesce(nullif(t.label, ''), t.group_key || '.' || t.key)",
    qualifierSql: 't.group_key',
    sortSql: "t.group_key || '.' || t.key",
    hasStatus: true,
    confirm: 'that this is Rivya’s own wording, shown across the site.',
    confirmByQualifier: {
      ANNOUNCEMENT: 'that Rivya wants this announced, in these words.',
      BRAND: 'that this is how Rivya describes itself.',
      COMMERCE_LABEL: 'that this label describes how Rivya actually sells.',
      WHATSAPP_TEMPLATE: 'that this is the message Rivya wants opened in a visitor’s WhatsApp.',
      SEO_DEFAULT: 'that this is how Rivya wants to be described in a search result.',
      SOCIAL: 'that this is how Rivya wants to be described on a shared link.',
    },
    rank: 20,
  },
  {
    table: 'navigation_items',
    surface: 'Navigation',
    studio: '/studio/content/navigation',
    identifierSql: "t.menu || ' · ' || t.label",
    qualifierSql: 't.menu',
    sortSql: "t.menu || ' · ' || lpad(t.position::text, 4, '0')",
    hasStatus: true,
    confirm: 'that this entry belongs in Rivya’s menu and points where Rivya intends.',
    rank: 30,
  },
  {
    table: 'faqs',
    surface: 'FAQ answers',
    studio: '/studio/content/faqs',
    identifierSql: 't.question',
    qualifierSql: "coalesce(t.category, '')",
    sortSql: "lpad(t.position::text, 4, '0')",
    hasStatus: true,
    confirm: 'that this answer is true of Rivya.',
    rank: 40,
  },
  {
    table: 'categories',
    surface: 'Categories',
    studio: '/studio/catalog/categories',
    identifierSql: "coalesce(nullif(t.name, ''), t.slug)",
    qualifierSql: "''",
    sortSql: 't.slug',
    hasStatus: true,
    confirm: 'that Rivya can make what this category describes.',
    rank: 50,
  },
  {
    table: 'collections',
    surface: 'Collections',
    studio: '/studio/catalog/collections',
    identifierSql: "coalesce(nullif(t.name, ''), t.slug)",
    qualifierSql: 't.concept_state::text',
    sortSql: 't.slug',
    hasStatus: true,
    confirm: 'that this collection describes work Rivya actually offers.',
    rank: 51,
  },
  {
    table: 'materials',
    surface: 'Materials',
    studio: '/studio/catalog/materials',
    identifierSql: "coalesce(nullif(t.name, ''), t.slug)",
    qualifierSql: "coalesce(t.family::text, '')",
    sortSql: 't.slug',
    hasStatus: true,
    confirm: 'that Rivya works in this material, as described here.',
    rank: 52,
  },
  {
    table: 'products',
    surface: 'Products',
    // `[productId]` resolves a uuid and nothing else, and a uuid changes on every `db:reset` — so
    // the list screen, which is stable, is what this document can honestly print. The same reason
    // build-content-inventory.ts gives for using the page SLUG rather than the page id.
    studio: '/studio/catalog/products',
    identifierSql: "coalesce(nullif(t.title, ''), t.slug)",
    qualifierSql: 't.price_state::text',
    sortSql: 't.slug',
    hasStatus: true,
    confirm:
      'that this piece exists as described — its dimensions, its materials and its price state.',
    rank: 53,
  },
  {
    table: 'product_specs',
    surface: 'Product specifications',
    studio: '/studio/catalog/products',
    identifierSql: "coalesce(nullif(pr.title, ''), pr.slug) || ' · ' || t.label",
    qualifierSql: "coalesce(t.group_label, '')",
    sortSql: "pr.slug || ':' || lpad(t.sort_order::text, 4, '0')",
    hasStatus: true,
    join: 'join products pr on pr.id = t.product_id',
    confirm: 'that this figure was measured from the real piece.',
    rank: 54,
  },
  {
    table: 'product_attribute_terms',
    surface: 'Product attribute terms',
    studio: null,
    noStudioScreen:
      'D4 has no attribute-term editor: the terms arrive with a migration or a bulk import, so ' +
      'clearing a flag here needs an engineer.',
    identifierSql: "t.taxonomy::text || ' · ' || t.name",
    qualifierSql: 't.taxonomy::text',
    sortSql: "t.taxonomy::text || ':' || t.slug",
    hasStatus: true,
    confirm: 'that this term describes something Rivya’s pieces really have.',
    rank: 55,
  },
  {
    table: 'customization_forms',
    surface: 'Commission forms',
    studio: '/studio/catalog/customization-forms',
    identifierSql: 't.name',
    qualifierSql: 't.kind::text',
    sortSql: 't.slug',
    hasStatus: true,
    confirm: 'that this form asks for what Rivya needs in order to answer a commission enquiry.',
    rank: 56,
  },
  {
    table: 'journal_categories',
    surface: 'Journal categories',
    studio: '/studio/content/journal/categories',
    identifierSql: 't.name',
    qualifierSql: "''",
    sortSql: "lpad(t.position::text, 4, '0')",
    hasStatus: true,
    confirm: 'that this is a subject Rivya writes about.',
    rank: 60,
  },
  {
    table: 'journal_articles',
    surface: 'Journal articles',
    studio: '/studio/content/journal',
    identifierSql: 't.title',
    qualifierSql: "''",
    sortSql: 't.slug',
    hasStatus: true,
    confirm: 'that what this article says about Rivya’s work and materials is true.',
    rank: 61,
  },
  {
    table: 'portfolio_projects',
    surface: 'Portfolio projects',
    studio: '/studio/content/portfolio',
    identifierSql: 't.title',
    qualifierSql: "case when t.is_client_project then 'CLIENT' else 'STUDIO' end",
    sortSql: 't.slug',
    hasStatus: true,
    confirm: 'that this project happened as described.',
    confirmByQualifier: {
      CLIENT:
        'that this project happened as described and that the client agreed to be named — the ' +
        'consent, not just the memory of it.',
    },
    rank: 70,
  },
  {
    table: 'testimonials',
    surface: 'Testimonials',
    studio: '/studio/content/testimonials',
    identifierSql: "coalesce(nullif(t.attributed_to, ''), t.id::text)",
    qualifierSql: 't.consent::text',
    sortSql: "lpad(t.sort_order::text, 4, '0') || ':' || t.id::text",
    hasStatus: true,
    confirm: 'that this person said this and agreed to it being published.',
    rank: 71,
  },
  {
    table: 'media_assets',
    surface: 'Media',
    studio: '/studio/media/all',
    identifierSql: "coalesce(nullif(t.title, ''), t.rivya_asset_id)",
    qualifierSql: 't.source::text',
    sortSql: 't.rivya_asset_id',
    hasStatus: true,
    confirm: 'that this asset may stand for Rivya’s work, given how it was made.',
    confirmByQualifier: {
      HIGGSFIELD:
        'that this generated image may stand for Rivya’s work — nothing in it is presented as a ' +
        'photograph of a delivered piece.',
      RENDER:
        'that this render may stand for Rivya’s work — nothing in it is presented as a photograph ' +
        'of a delivered piece.',
      FALLBACK: 'that this placeholder is acceptable in public, or should be replaced first.',
    },
    rank: 80,
  },
  {
    table: 'model_variant_labels',
    surface: '3D model material labels',
    studio: '/studio/media/models',
    identifierSql: "ma.rivya_asset_id || ' · ' || t.label",
    qualifierSql: "case when t.material_id is null then '' else 'MATERIAL' end",
    sortSql: "ma.rivya_asset_id || ':' || lpad(t.position::text, 4, '0')",
    // The only child row here with no status of its own: a label is part of its asset (DATA_MODEL
    // §1.4), so what publishes is the asset.
    hasStatus: false,
    join: 'join media_assets ma on ma.id = t.media_asset_id',
    confirm: 'that this label names what the model actually shows.',
    confirmByQualifier: {
      MATERIAL: 'that this variant really is the material it is pointed at.',
    },
    rank: 81,
  },
  {
    table: 'seo_entries',
    surface: 'SEO entries',
    studio: '/studio/content/seo',
    identifierSql: "t.scope::text || coalesce(' ' || t.path, '')",
    qualifierSql: 't.scope::text',
    sortSql: "t.scope::text || coalesce(' ' || t.path, '')",
    hasStatus: true,
    confirm: 'that this is how Rivya wants to be described in a search result.',
    rank: 90,
  },
  {
    table: 'seo_keyword_themes',
    surface: 'SEO keyword themes',
    studio: '/studio/content/seo?tab=keywords',
    identifierSql: 't.theme',
    qualifierSql: 't.research_status::text',
    sortSql: 't.normalized_theme',
    hasStatus: true,
    confirm: 'that Rivya serves the place and the service this phrase implies.',
    rank: 91,
  },
  {
    table: 'seo_redirects',
    surface: 'Redirects',
    studio: '/studio/content/seo?tab=redirects',
    identifierSql: "t.from_path || ' → ' || t.to_path",
    qualifierSql: 't.status_code::text',
    sortSql: 't.from_path',
    hasStatus: true,
    confirm: 'that this old address should send a visitor to this new one.',
    rank: 92,
  },
  {
    /*
     * INTERNAL, AND IT STAYS INTERNAL. A direction brief is research; D5 forbids it reaching a
     * visitor at all. It appears in this backlog because the column is there and the owner is the
     * only person who can approve a direction — never because anything here could be published.
     */
    table: 'research_direction_briefs',
    surface: 'Research direction briefs (internal only)',
    studio: '/studio/research/opportunities/direction',
    identifierSql: "coalesce(nullif(t.title, ''), t.slug)",
    qualifierSql: "''",
    sortSql: 't.slug',
    hasStatus: true,
    confirm: 'that this is a direction Rivya wants to pursue. It is never published either way.',
    rank: 99,
  },
]

/** Every declared table, in declaration order. Imported by the PostgREST counter. */
export const VERIFICATION_TABLES: readonly VerificationTable[] = VERIFICATION_SURFACES.map(
  (surface) => surface.table,
)

/** A single-quoted SQL literal. Only ever given constants from this file. */
function literal(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`
}

/**
 * THE FLAGGED ROWS, AS ONE STATEMENT.
 *
 * A `union all` over the declared surfaces, each projecting the same eight columns, so a `pg`
 * caller gets the whole backlog in one round trip and the shaping below has one row type to
 * handle. No `order by`: the ordering that matters is the document's, and it is applied in
 * TypeScript where the comparator can be read.
 */
export function verificationBacklogSql(): string {
  return VERIFICATION_SURFACES.map((surface) => {
    const studio =
      surface.studioSql ?? (surface.studio === null ? 'null::text' : literal(surface.studio))
    return [
      `select ${literal(surface.table)}::text as source_table,`,
      `       (${surface.surfaceSql ?? literal(surface.surface)})::text as surface,`,
      `       (${surface.identifierSql})::text as identifier,`,
      `       (${surface.qualifierSql})::text as qualifier,`,
      `       (t.fact_classification)::text as classification,`,
      `       (${surface.hasStatus ? 't.status' : 'null'})::text as status,`,
      `       (${surface.sortSql})::text as sort_key,`,
      `       (${studio})::text as studio`,
      `  from ${surface.table} t`,
      ...(surface.join === undefined ? [] : [`  ${surface.join}`]),
      ` where t.owner_verification = ${literal(OWNER_VERIFICATION_REQUIRED)}`,
    ].join('\n')
  }).join('\nunion all\n')
}

/**
 * WHICH TABLES ACTUALLY CARRY THE COLUMN — the drift guard the compiler cannot be.
 *
 * `VerificationTable` catches a table that is renamed away. It cannot catch a table that GAINS
 * `owner_verification` in a later migration: that table is simply absent from this file, its
 * flagged rows never appear in the handover document, and the owner is handed a backlog that is
 * quietly incomplete. The generator asks the database for this list and refuses to write when it
 * does not match the declaration above.
 */
export const VERIFICATION_TABLES_SQL = `
  select table_name::text as table_name
    from information_schema.columns
   where table_schema = 'public'
     and column_name = 'owner_verification'
   order by table_name
`

/**
 * WHAT THE DATABASE DOES ABOUT AN UNCONFIRMED ROW, read from the catalogues rather than asserted.
 *
 * The claim this section makes — that the backlog is a publication blocker rather than a wish
 * list — is a claim about Phase 08's enforcement, and it is not uniform: most of these tables
 * carry a `<table>_verified_before_publish` CHECK constraint, `portfolio_projects` and
 * `testimonials` carry an evidence-gate TRIGGER that demands VERIFIED outright, and a table may
 * carry neither. Printing "nothing here can publish" over a table with no gate would be exactly
 * the aspirational documentation Phase 46 exists to remove, so the gate is looked up per table and
 * named, and a table with no gate is reported as having none.
 */
export const VERIFICATION_GATES_SQL = `
  select c.relname::text as table_name,
         (select con.conname::text
            from pg_constraint con
           where con.conrelid = c.oid
             and con.contype = 'c'
             and pg_get_constraintdef(con.oid) like '%owner_verification%'
             and pg_get_constraintdef(con.oid) like '%PUBLISHED%'
           order by con.conname
           limit 1) as constraint_name,
         (select p.proname::text
            from pg_trigger tg
            join pg_proc p on p.oid = tg.tgfoid
           where tg.tgrelid = c.oid
             and not tg.tgisinternal
             and p.prosrc like '%owner_verification%'
             and p.prosrc like '%PUBLISHED%'
           order by p.proname
           limit 1) as trigger_function
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
   order by c.relname
`

/**
 * The row shape the statement above returns.
 *
 * Zod rather than a bare generic, because this is the seam where a renamed column becomes a
 * missing cell in a committed document: `undefined` reads as an empty table cell and nobody
 * notices, whereas a parse failure names the table and stops the write.
 */
const flaggedRecordSchema = z.object({
  source_table: z.string().min(1),
  surface: z.string().min(1),
  identifier: z.string().nullable(),
  qualifier: z.string().nullable(),
  classification: factClassificationSchema.nullable(),
  status: z.string().nullable(),
  sort_key: z.string().nullable(),
  studio: z.string().nullable(),
})

export type FlaggedRecord = z.infer<typeof flaggedRecordSchema>

export interface FlaggedRow {
  readonly table: VerificationTable
  readonly surface: string
  readonly identifier: string
  readonly qualifier: string
  readonly classification: Enums<'fact_classification'> | null
  /** `null` for the one child table with no publication status of its own. */
  readonly status: string | null
  readonly sortKey: string
  /** `null` where no Studio screen edits this table; `noStudioScreen` then says so. */
  readonly studio: string | null
  readonly confirm: string
}

/** How the database refuses to publish a flagged row of one table, or that it does not. */
export type PublicationGate =
  | { readonly kind: 'CHECK'; readonly name: string }
  | { readonly kind: 'TRIGGER'; readonly name: string }
  | { readonly kind: 'NONE' }

export interface VerificationGroup {
  readonly surface: string
  readonly rank: number
  readonly rows: readonly FlaggedRow[]
  /** The screens for this group's rows — normally one; a page group names the page's own screen. */
  readonly studio: readonly string[]
  readonly gates: readonly { readonly table: VerificationTable; readonly gate: PublicationGate }[]
}

export interface VerificationBacklog {
  readonly total: number
  readonly groups: readonly VerificationGroup[]
  /** Tables with flagged rows and no gate refusing a publish. Named, never silently omitted. */
  readonly ungated: readonly VerificationTable[]
  readonly publishedAnyway: number
  readonly unpublished: number
}

function surfaceFor(table: string): VerificationSurface | undefined {
  return VERIFICATION_SURFACES.find((surface) => surface.table === table)
}

/**
 * The question put to the owner for one row: the table's sentence, unless the row's own
 * classification or grouping column has a more exact one.
 */
export function confirmationFor(
  surface: VerificationSurface,
  classification: Enums<'fact_classification'> | null,
  qualifier: string,
): string {
  const byQualifier = qualifier === '' ? undefined : surface.confirmByQualifier?.[qualifier]
  if (byQualifier !== undefined) return byQualifier
  const byClassification =
    classification === null ? undefined : surface.confirmByClassification?.[classification]
  return byClassification ?? surface.confirm
}

/** Locale-independent, because the output is committed and diffed on two machines. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Shape the rows into the document's groups.
 *
 * REFUSES A ROW FROM A TABLE IT DOES NOT KNOW rather than dropping it. A row reaching here from an
 * undeclared table means the statement and the declaration have come apart, and the failure mode of
 * dropping it is a handover document that is missing a publication blocker.
 */
export function shapeBacklog(
  records: readonly unknown[],
  gates: ReadonlyMap<string, PublicationGate>,
): VerificationBacklog {
  const rowsBySurface = new Map<string, { rank: number; rows: FlaggedRow[] }>()
  const tablesBySurface = new Map<string, Set<VerificationTable>>()
  let publishedAnyway = 0
  let unpublished = 0

  for (const record of records) {
    const parsed = flaggedRecordSchema.parse(record)
    const surface = surfaceFor(parsed.source_table)
    if (surface === undefined) {
      throw new Error(
        `verification backlog: a flagged row arrived from "${parsed.source_table}", which is not ` +
          'declared in VERIFICATION_SURFACES (lib/cms/verification-backlog.ts). Declare it — a ' +
          'publication blocker left out of the handover document is worse than a failed run.',
      )
    }
    const qualifier = parsed.qualifier ?? ''
    const row: FlaggedRow = {
      table: surface.table,
      surface: parsed.surface,
      identifier: parsed.identifier ?? parsed.surface,
      qualifier,
      classification: parsed.classification,
      status: parsed.status,
      sortKey: parsed.sort_key ?? parsed.identifier ?? '',
      studio: parsed.studio,
      confirm: confirmationFor(surface, parsed.classification, qualifier),
    }
    if (row.status === 'PUBLISHED') publishedAnyway += 1
    else if (row.status !== null) unpublished += 1

    const bucket = rowsBySurface.get(row.surface) ?? { rank: surface.rank, rows: [] }
    bucket.rows.push(row)
    rowsBySurface.set(row.surface, bucket)
    const tables = tablesBySurface.get(row.surface) ?? new Set<VerificationTable>()
    tables.add(surface.table)
    tablesBySurface.set(row.surface, tables)
  }

  const groups: VerificationGroup[] = [...rowsBySurface.entries()]
    .map(([name, bucket]) => {
      const rows = [...bucket.rows].sort(
        (a, b) => compare(a.sortKey, b.sortKey) || compare(a.identifier, b.identifier),
      )
      const studio = [...new Set(rows.flatMap((row) => (row.studio === null ? [] : [row.studio])))]
      studio.sort(compare)
      const tables = [...(tablesBySurface.get(name) ?? new Set<VerificationTable>())]
      tables.sort(compare)
      return {
        surface: name,
        rank: bucket.rank,
        rows,
        studio,
        gates: tables.map((table) => ({ table, gate: gates.get(table) ?? { kind: 'NONE' } })),
      }
    })
    .sort((a, b) => a.rank - b.rank || compare(a.surface, b.surface))

  const ungated = [
    ...new Set(
      groups.flatMap((group) =>
        group.gates.flatMap((entry) => (entry.gate.kind === 'NONE' ? [entry.table] : [])),
      ),
    ),
  ].sort(compare)

  return {
    total: groups.reduce((sum, group) => sum + group.rows.length, 0),
    groups,
    ungated,
    publishedAnyway,
    unpublished,
  }
}

/**
 * `|` would break the table and a newline inside a cell breaks it worse — the same rule, and the
 * same two replacements, as the sibling generators (scripts/content/build-content-inventory.ts,
 * scripts/media/build-asset-status.ts). Deliberately local to each generator: one shared helper
 * across four documents would mean one document's escaping change silently reformatting the others.
 */
function cell(value: string | null): string {
  if (value === null || value === '') return '—'
  return value.replace(/\|/gu, '\\|').replace(/\n+/gu, ' ').trim()
}

function gateSentence(gate: PublicationGate): string {
  if (gate.kind === 'CHECK') return `\`${gate.name}\` refuses \`status = 'PUBLISHED'\``
  if (gate.kind === 'TRIGGER') return `trigger \`${gate.name}()\` refuses the publish`
  return '**no database gate** — the flag records the requirement, nothing enforces it'
}

/**
 * The generated section of `docs/content/INITIAL_CONTENT_INVENTORY.md`.
 *
 * WHY IT LIVES IN THE SAME DOCUMENT as the inventory rather than a file of its own: the inventory
 * already answers "what was seeded and where is it edited" for every row, and the backlog answers
 * "and which of those cannot go live yet". Two documents would be two things to keep in step, and
 * the one the owner opened would be the stale one. `npm run content:check-inventory` regenerates
 * and diffs the whole file, so both sections are held to the database together.
 */
export function verificationBacklogMarkdown(backlog: VerificationBacklog): string {
  const groups = backlog.groups
  const lines: string[] = [
    '## Owner-verification backlog',
    '',
    '> GENERATED by `npm run content:verification-report`, from the same database and in the same',
    '> run as the inventory above (`scripts/content/build-verification-report.ts`). Do not edit by',
    '> hand — the next run overwrites it.',
    '',
    'Every row below carries `owner_verification = OWNER_VERIFICATION_REQUIRED`: it says something',
    'about a real business that nobody at Rivya has confirmed. **This is a publication blocker, not',
    'a wish list** — the database refuses to publish these rows, per table, as the second column of',
    'the summary shows. Nothing here is a claim this repository makes about Rivya; it is seeded',
    'copy, a seeded detail or a media binding awaiting the owner’s confirmation, and D10 says the',
    'owner is the only person who can give it.',
    '',
    `- **${String(backlog.total)}** rows outstanding across **${String(groups.length)}** surfaces`,
    '- Counted in ROWS, which is what the `/studio` card counts. The field-level figure earlier in',
    '  this document is larger because it counts every heading, body and CTA label separately,',
    '  while the flag itself lives on the row.',
  ]

  if (backlog.unpublished > 0) {
    lines.push(
      `- **${String(backlog.unpublished)}** are still unpublished, which is the gate doing its job.`,
    )
  }
  if (backlog.publishedAnyway > 0) {
    lines.push(
      `- **${String(backlog.publishedAnyway)}** are PUBLISHED despite the flag — possible only` +
        ' where the table carries no gate. Read the summary below before trusting any of them.',
    )
  }
  if (backlog.ungated.length > 0) {
    lines.push(
      `- No database gate exists on: ${backlog.ungated.map((table) => `\`${table}\``).join(', ')}.` +
        ' For these the flag is a record of the requirement and nothing more.',
    )
  }
  if (backlog.total === 0) {
    lines.push(
      '',
      'Nothing is outstanding on the database this was generated from. That is a statement about',
      'the rows, not about the owner having reviewed them: a freshly reset database has whatever',
      'the seed set, and a handover copy of this document should be generated from the database the',
      'owner actually uses.',
      '',
    )
    return lines.join('\n')
  }

  lines.push(
    '',
    '### Outstanding by surface',
    '',
    '| Surface | Rows | Where the owner resolves it | What the database does about it |',
    '|---|---|---|---|',
    ...groups.map((group) => {
      const where =
        group.studio.length === 0
          ? cell(
              group.rows
                .map((row) => surfaceFor(row.table)?.noStudioScreen ?? '')
                .find((note) => note !== '') ?? null,
            )
          : group.studio.map((path) => `\`${path}\``).join(' ')
      const gates = group.gates.map((entry) => gateSentence(entry.gate)).join('; ')
      return `| ${cell(group.surface)} | ${String(group.rows.length)} | ${where} | ${gates} |`
    }),
    '',
    '### Every outstanding row',
    '',
    '| Surface | Item | Classification | What the owner must confirm | Where to resolve it |',
    '|---|---|---|---|---|',
    ...groups.flatMap((group) =>
      group.rows.map((row) => {
        const where =
          row.studio === null
            ? cell(surfaceFor(row.table)?.noStudioScreen ?? null)
            : `\`${row.studio}\``
        return (
          `| ${cell(group.surface)} | ${cell(row.identifier)} | ${cell(row.classification)} ` +
          `| Confirm ${cell(row.confirm)} | ${where} |`
        )
      }),
    ),
    '',
  )

  return lines.join('\n')
}

/**
 * THE READER, AGAINST AN ABSTRACT CURSOR RATHER THAN A DRIVER.
 *
 * This module imports no database client and must not: it is read from a Server Component (through
 * the PostgREST counter) and from a script (through `pg`), and importing `pg` here would pull a
 * Node driver into the Next.js graph. So the reader asks for the smallest thing that can answer a
 * statement — `pg.Client` satisfies it structurally, and a unit test can satisfy it with an object
 * literal, which is the only way to test the shaping without a database.
 *
 * PostgREST CANNOT satisfy this interface: it has no arbitrary-SQL door, deliberately. That is why
 * the `/studio` card counts per table instead — see `lib/supabase/repositories/verifications.ts` —
 * and why both callers share the SURFACES rather than a query.
 */
export interface SqlReader {
  query(sql: string): Promise<{ rows: readonly unknown[] }>
}

const gateRecordSchema = z.object({
  table_name: z.string().min(1),
  constraint_name: z.string().nullable(),
  trigger_function: z.string().nullable(),
})

/** What the database does about an unconfirmed row of each table, read from the catalogues. */
export async function readPublicationGates(
  read: SqlReader,
): Promise<ReadonlyMap<string, PublicationGate>> {
  const gates = new Map<string, PublicationGate>()
  for (const record of (await read.query(VERIFICATION_GATES_SQL)).rows) {
    const row = gateRecordSchema.parse(record)
    if (row.constraint_name !== null) {
      gates.set(row.table_name, { kind: 'CHECK', name: row.constraint_name })
    } else if (row.trigger_function !== null) {
      gates.set(row.table_name, { kind: 'TRIGGER', name: row.trigger_function })
    }
  }
  return gates
}

const tableRecordSchema = z.object({ table_name: z.string().min(1) })

/**
 * THE DRIFT GUARD THE COMPILER CANNOT BE.
 *
 * `VerificationTable` is bound to the generated `Database` type, so a table RENAMED away stops
 * compiling. A table that GAINS `owner_verification` in a later migration compiles perfectly and is
 * simply absent: its flagged rows never reach the handover document, and the owner is handed a
 * backlog that is quietly incomplete while every gate stays green. So the database is asked which
 * tables really carry the column, and the two lists must agree.
 */
export async function assertEveryFlaggedTableIsDeclared(read: SqlReader): Promise<void> {
  const actual = (await read.query(VERIFICATION_TABLES_SQL)).rows.map(
    (record) => tableRecordSchema.parse(record).table_name,
  )
  const declared = new Set<string>(VERIFICATION_TABLES)
  const undeclared = actual.filter((name) => !declared.has(name)).sort(compare)
  const missing = [...declared].filter((name) => !actual.includes(name)).sort(compare)

  if (undeclared.length > 0) {
    throw new Error(
      `${String(undeclared.length)} table(s) carry owner_verification and are not declared in ` +
        `lib/cms/verification-backlog.ts — ${undeclared.join(', ')}.\n` +
        'Declare each one (a surface, a Studio path and the sentence the owner is asked), or the\n' +
        'handover document omits a publication blocker without saying so.',
    )
  }
  if (missing.length > 0) {
    throw new Error(
      `${String(missing.length)} declared table(s) have no owner_verification column on this ` +
        `database — ${missing.join(', ')}.\n` +
        'Either the migrations have not been applied here, or the declaration is out of date.',
    )
  }
}

/** The flagged rows, the total and the per-surface groups. The shared answer, as one function. */
export async function readVerificationBacklog(read: SqlReader): Promise<VerificationBacklog> {
  await assertEveryFlaggedTableIsDeclared(read)
  const gates = await readPublicationGates(read)
  const flagged = await read.query(verificationBacklogSql())
  return shapeBacklog(flagged.rows, gates)
}

/** The generated section, for the one writer of `docs/content/INITIAL_CONTENT_INVENTORY.md`. */
export async function buildVerificationBacklog(read: SqlReader): Promise<string> {
  return verificationBacklogMarkdown(await readVerificationBacklog(read))
}
