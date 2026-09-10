import { z } from 'zod'

import { MIN_SCHEDULE_INTERVAL_MINUTES, cronMinIntervalMinutes } from './cron'

/**
 * The twenty-three FEAT §26 fields, as the one shape a source is validated against.
 *
 * THE FIELD TABLE IN THE PHASE DOCUMENT IS THE SPECIFICATION FOR THIS FILE — `docs/project/phases/
 * PHASE-23-30.md`, "PHASE 26 — Comparator Source Management", the table headed *The twenty-three
 * FEAT §26 fields, each with a home*. That table says of itself that the migration and the form are
 * both generated from reading it, so it is reproduced here as field number → the key that carries
 * it. A reader can then check this module against the requirement without holding both open, and a
 * field that quietly loses its home shows up as a gap in a numbered list rather than as an absence
 * nobody notices.
 *
 *    #   FEAT §26 field        Carried by
 *    1   Name                  sourceInputSchema.name
 *    2   Website               sourceInputSchema.baseUrl
 *    3   Region                sourceInputSchema.region
 *    4   Currency              sourceInputSchema.currency
 *    5   Source Type           sourceInputSchema.sourceType           (SOURCE_TYPES)
 *    6   Analytics League      sourceInputSchema.analyticsLeague      (ANALYTICS_LEAGUES)
 *    7   Enabled               deliberately absent — see "the enable gate" below
 *    8   Collection Mode       sourceInputSchema.collectionMode       (COLLECTION_MODES)
 *    9   Category Mapping      categoryMappingInputSchema             (one child row each)
 *   10   URL Patterns          urlPatternInputSchema                  (one child row each)
 *   11   Extraction Adapter    sourceInputSchema.adapterKey
 *   12   Image Extraction      sourceInputSchema.imageExtractionMode  (IMAGE_EXTRACTION_MODES)
 *   13   Price Extraction      sourceInputSchema.priceExtraction      (priceExtractionSchema)
 *   14   SKU Extraction        sourceInputSchema.skuExtraction        (skuExtractionSchema)
 *   15   Attribute Extraction  sourceInputSchema.attributeExtraction  (attributeExtractionSchema)
 *   16   Rate Limit            sourceInputSchema.rateLimitRpm
 *   17   Request Delay         sourceInputSchema.requestDelayMs
 *   18   Concurrency           sourceInputSchema.concurrency
 *   19   Scheduling            scheduleInputSchema                    (one child row each)
 *   20   Last Run              derived — `research_source_health_v.last_run_at`, never posted
 *   21   Health                derived — `research_source_health_v.health`, never posted
 *   22   Policy Review         policyDecisionSchema                   (owner or admin only)
 *   23   Notes                 sourceInputSchema.notes
 *
 * Field 7's readiness counterpart — `sourceInputSchema.readiness` — is not one of the twenty-three.
 * It is `research_sources.readiness`, the researcher's half of the policy workflow that migration
 * `0240` adds beside them, and it lives in this schema because the same drawer writes it.
 *
 * THE ENABLE GATE IS WHY FIELD 7 IS NOT HERE. Enabling a source needs `research.write` **and**
 * `system.settings.write`, and the database refuses `is_enabled = true` unless `policy_status =
 * 'APPROVED'` (`research_sources_enabled_requires_approval`, migration 0231). Putting `isEnabled`
 * into the schema the researcher's drawer posts would mean the researcher's form carried the
 * owner's field, and the only thing standing between the two would be a permission check somebody
 * has to remember to write on a code path that already validates cleanly. The enable action
 * validates its one boolean on its own, under both permissions; this schema cannot express the
 * request at all, which is the stronger arrangement.
 *
 * NO `server-only` MARKER, AND THAT IS A REQUIREMENT RATHER THAN AN OVERSIGHT. The create/edit
 * drawer is a Client Component — a form with a strategy picker that changes which selector fields
 * are shown cannot be anything else — and it validates what it is about to post with these very
 * schemas, so the two halves of the boundary agree about what is refusable. `server-only` resolves
 * to a module that throws when it reaches a client bundle, so adding it here would make the form
 * unbuildable. Nothing in this file touches a secret, a database handle or the network, so there is
 * nothing for the marker to protect.
 *
 * NOTHING FROM `lib/supabase/**` IS IMPORTED, for the same boundary and one more reason: this is
 * the shape of a FORM, not the shape of a ROW. The generated database types describe columns,
 * defaults and nullability as PostgreSQL sees them; a form posts `null` where a column has a
 * default and omits the derived columns entirely. Deriving one from the other would tie the drawer
 * to `database.types.ts` and drag the client library into a Client Component for a type.
 *
 * EVERY OBJECT IS `.strict()`, for the reason `lib/scraper/core/raw.ts` gives at length: an extra
 * key is a shortcut landing early. A source configuration is the place where "just one more
 * option" is easiest to add and hardest to review, and an unrecognised key that parsed silently
 * would reach `research_sources` as jsonb nobody designed for, to be read later by a Phase 27
 * adapter that has to decide what it means.
 *
 * WHERE THIS SCHEMA AND MIGRATION `0240` DESCRIBE THE SAME RULE, THEY DESCRIBE IT IDENTICALLY. That
 * migration says why in its own words, and it is worth repeating because it is the governing idea
 * of this file: *a form stricter than its table is a form somebody bypasses with a server action*.
 * The two agreeing is the point. Each mirrored bound below names the constraint it mirrors, so a
 * future change to either can be checked against the other.
 */

/* --- 1. The allowlists, exactly as the database spells them ------------------------------------ */

/** FEAT §26 field 5. `research_source_type`, in the migration's order. */
export const SOURCE_TYPES = [
  'BRAND',
  'RETAILER',
  'MARKETPLACE',
  'GALLERY',
  'ARTISAN',
  'DIRECTORY',
] as const

/**
 * FEAT §26 field 6. `research_analytics_league`.
 *
 * STAFF-ONLY FOREVER. The type's own comment in `0240` says there is no surface on which this may
 * be rendered to a visitor, and the phase document repeats it: it is Rivya's private view of where
 * another business sits relative to it, never a public label.
 */
export const ANALYTICS_LEAGUES = ['PEER', 'ASPIRATIONAL', 'ADJACENT', 'MASS'] as const

/**
 * FEAT §26 field 8. `research_collection_mode`.
 *
 * `SEED_URLS` is the only mode Phase 25's engine implements. The other three are in the allowlist
 * so that teaching the engine one is code rather than a migration, and a source configured to a
 * mode nothing can run yet queues nothing and says so.
 */
export const COLLECTION_MODES = ['SITEMAP', 'CATEGORY_CRAWL', 'SEED_URLS', 'FEED'] as const

/**
 * FEAT §26 field 12. `research_image_extraction_mode`.
 *
 * NOT ONE OF THESE THREE VALUES DOWNLOADS AN IMAGE. The most permissive, `URL_AND_DIMENSIONS`,
 * stores a URL string and two integers the page itself declared. There is no mode that re-hosts,
 * caches, transforms or uploads a competitor image, here or anywhere.
 */
export const IMAGE_EXTRACTION_MODES = ['NONE', 'URL_ONLY', 'URL_AND_DIMENSIONS'] as const

/** `research_sources_readiness_allowlist`. The researcher's side of the policy workflow. */
export const READINESS_STATES = ['DRAFT', 'READY_FOR_REVIEW', 'REVIEWED'] as const

/** `research_source_url_patterns_kind_allowlist`. FEAT §26 field 10. */
export const URL_PATTERN_KINDS = ['PRODUCT', 'CATEGORY', 'EXCLUDE', 'PAGINATION'] as const

/** `research_job_type` (migration 0230). FEAT §26 field 19 schedules one of these. */
export const SCHEDULE_JOB_TYPES = ['DISCOVERY', 'DETAIL', 'REFRESH'] as const

/**
 * The three decisions a policy review may reach — `research_policy_status` minus `UNREVIEWED`.
 *
 * `UNREVIEWED` IS NOT A DECISION AND SO IS NOT OFFERED. It is where every source starts, and a
 * review panel that could set it would be a way to un-review a source without saying so; the
 * record of what was decided, by whom and when would then have a hole in it exactly where somebody
 * changed their mind.
 */
export const POLICY_DECISIONS = ['APPROVED', 'RESTRICTED', 'BLOCKED'] as const

/** FEAT §26 field 15's six keys, verbatim from the phase document's field table. */
export const ATTRIBUTE_KEYS = [
  'dimensions',
  'materials',
  'availability',
  'lead_time',
  'variants',
  'customization',
] as const

/** How a price or SKU is located on a page. `NONE` means the source does not publish one. */
export const EXTRACTION_STRATEGIES = ['SELECTOR', 'JSONLD_PATH', 'NONE'] as const

/** What an attribute rule reads once its selector has matched. */
export const ATTRIBUTE_RULE_KINDS = ['TEXT', 'ATTRIBUTE', 'JSONLD_PATH'] as const

export type SourceType = (typeof SOURCE_TYPES)[number]
export type AnalyticsLeague = (typeof ANALYTICS_LEAGUES)[number]
export type CollectionMode = (typeof COLLECTION_MODES)[number]
export type ImageExtractionMode = (typeof IMAGE_EXTRACTION_MODES)[number]
export type ReadinessState = (typeof READINESS_STATES)[number]
export type UrlPatternKind = (typeof URL_PATTERN_KINDS)[number]
export type ScheduleJobType = (typeof SCHEDULE_JOB_TYPES)[number]
export type PolicyDecisionStatus = (typeof POLICY_DECISIONS)[number]
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]
export type ExtractionStrategy = (typeof EXTRACTION_STRATEGIES)[number]
export type AttributeRuleKind = (typeof ATTRIBUTE_RULE_KINDS)[number]

/* --- 2. The politeness numbers, mirrored from the CHECKs --------------------------------------- */

/** FEAT §26 field 16, and `research_sources_rate_limit_sane`: `rate_limit_rpm between 1 and 60`. */
export const RATE_LIMIT_RPM_MIN = 1
export const RATE_LIMIT_RPM_MAX = 60

/**
 * FEAT §26 field 17, and `research_sources_delay_sane`: `request_delay_ms between 1000 and 600000`.
 *
 * THE FLOOR IS A FLOOR, NOT A SETTING THE ENGINE HONOURS AS TYPED. `robots.txt`'s `Crawl-delay`
 * raises it and never lowers it (Phase 25, `lib/scraper/core/robots.ts`), so a source configured at
 * this minimum against a host asking for thirty seconds waits thirty seconds.
 */
export const REQUEST_DELAY_MS_MIN = 1000
export const REQUEST_DELAY_MS_MAX = 600_000

/** FEAT §26 field 18, and `research_sources_concurrency_sane`: `concurrency between 1 and 4`. */
export const CONCURRENCY_MIN = 1
export const CONCURRENCY_MAX = 4

/**
 * `research_source_url_patterns_length_capped`: `char_length(pattern) between 1 and 200`.
 *
 * A LENGTH CAP IS THE ONE BOUND THAT HOLDS WHATEVER THE EXPRESSION SAYS. A pathological regex is a
 * denial of service aimed at Rivya's own cron function by way of a URL a third party chose, and no
 * amount of reading the expression tells you it will terminate. Two hundred characters is generous
 * for a real URL shape and short enough that the damage a bad one can do is bounded.
 */
export const URL_PATTERN_MAX_LENGTH = 200

/** `research_source_url_patterns_priority_sane`: `priority between 0 and 1000`. */
export const URL_PATTERN_PRIORITY_MIN = 0
export const URL_PATTERN_PRIORITY_MAX = 1000

/**
 * How many attribute rules one source may carry.
 *
 * Six keys, read first-match-wins, with room for several competing selectors each. Forty is well
 * past what a real configuration needs and bounded enough that the ordered list stays something a
 * reviewer reads rather than scrolls. The database checks only that the column is an array, so this
 * cap is genuinely this schema's alone — said plainly, because everything else in this file is
 * mirrored from a constraint and a reader is entitled to know which rules are not.
 */
export const MAX_ATTRIBUTE_RULES = 40

/** A CSS selector or JSON-LD path. Long enough for a nested selector, short enough to read. */
export const SELECTOR_MAX_LENGTH = 300

/** Staff-only free text: FEAT §26 field 23, pattern notes, and a policy reviewer's reasoning. */
export const NOTES_MAX_LENGTH = 4000

/**
 * The shortest policy note the review panel will accept.
 *
 * THE PHASE DOCUMENT CALLS IT "a mandatory notes field", AND A MANDATORY FIELD SATISFIED BY "ok" IS
 * NOT ONE. This is the record of a judgement about what a third party's terms permit — the one
 * determination this repository is explicitly not competent to make on the owner's behalf — and the
 * person who reads it next will be somebody asking why a source was approved. Twenty characters is
 * not a quality bar; it is the point below which nothing was written down at all.
 */
export const POLICY_NOTES_MIN_LENGTH = 20

/** Identifier and label lengths. The table caps none of these; the form is where a slip is caught. */
export const SLUG_MAX_LENGTH = 64
export const NAME_MAX_LENGTH = 200
export const ADAPTER_KEY_MAX_LENGTH = 64
export const SOURCE_LABEL_MAX_LENGTH = 200
export const SOURCE_PATH_MAX_LENGTH = 500

/**
 * The longest `base_url` this schema accepts.
 *
 * THE ONE BOUND HERE THAT `0240` DOES NOT ALSO CARRY, and it is named rather than slipped in. The
 * column is `text` and the constraint says nothing about length, so in principle this is the
 * disagreement the constraint's own comment warns about. It is not, because it cannot refuse
 * anything the engine could use: `lib/scraper/core/raw.ts` stores no URL longer than 2048
 * characters, so a base URL past that produces a source every derived URL of which is refused
 * later, one at a time, with no message that mentions the base URL. Refusing it once, in the form,
 * where the person who typed it is looking, is the same decision made legibly.
 */
export const BASE_URL_MAX_LENGTH = 2048

/* --- 3. The shared field grammars -------------------------------------------------------------- */

/**
 * FEAT §26 field 2. `https` for a real source; `http` for loopback only.
 *
 * THESE TWO EXPRESSIONS ARE `research_sources_base_url_is_http`, CHARACTER FOR CHARACTER. The
 * constraint reads:
 *
 *     base_url ~ '^https://'
 *     or base_url ~ '^http://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]+)?(/|$)'
 *
 * and the migration explains at length why the loopback exception is named rather than implied: the
 * claims that matter most in this subsystem are claims about requests that must NOT happen — a
 * `Disallow`ed path never requested, a kill switch that produced zero traffic, a delay actually
 * waited — and the only way to check those is a real HTTP server this repository starts and reads
 * the request log of. Such a server cannot present a certificate. Forcing `https` here would not
 * make the system safer; it would delete the tests that prove it is.
 *
 * A FORM STRICTER THAN ITS TABLE IS A FORM SOMEBODY BYPASSES WITH A SERVER ACTION, and one looser
 * than its table is a form that accepts a value and then shows the operator a constraint violation
 * naming a constraint they have never heard of. The two agreeing is the point, and it is why
 * neither expression carries the case-insensitive flag: PostgreSQL's `~` is case-sensitive, so
 * `HTTPS://` is refused by the table and must be refused here for the same reason.
 */
const HTTPS_BASE_URL = /^https:\/\//
const LOOPBACK_BASE_URL = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:[0-9]+)?(\/|$)/

/** Lowercase kebab: what `citext unique` stores and what a URL segment can carry unescaped. */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** ISO-3166-1 alpha-2, uppercase. */
const ALPHA_2 = /^[A-Z]{2}$/

/** ISO-4217 alpha-3, uppercase. */
const ALPHA_3 = /^[A-Z]{3}$/

/**
 * FEAT §26 field 3. A two-letter country code, or the whole world.
 *
 * `GLOBAL` IS A VALUE RATHER THAN AN EMPTY REGION, because "we did not say" and "this source sells
 * everywhere" are different facts and Phase 31 groups by this column. The table carries no
 * allowlist for `region` at all — it is plain `text` — so unlike almost everything else in this
 * file, this rule exists only here. That is stated rather than implied: a direct SQL write can
 * store `Asia` in this column, and the reader that meets it will have to cope.
 */
const regionSchema = z
  .string()
  .trim()
  .refine((value) => value === 'GLOBAL' || ALPHA_2.test(value), {
    message: 'Region is an ISO-3166-1 alpha-2 code in upper case, or the literal GLOBAL.',
  })

/**
 * FEAT §26 field 4. The source's *stated* currency.
 *
 * NEVER CONVERTED, ANYWHERE. Not here, not in Phase 28's normalisation, not in Phase 31's
 * analytics. A price read from another business's page is a number that business published in a
 * currency it chose, and converting it would produce a figure nobody quoted, at a rate nobody
 * recorded, on a date nobody kept — which would then be compared against a real Rivya price. Where
 * two sources cannot be compared without a conversion, the honest answer is that they are not
 * compared.
 */
const currencySchema = z
  .string()
  .trim()
  .regex(ALPHA_3, 'Currency is an ISO-4217 alpha-3 code in upper case, and is never converted.')

/**
 * Free text a person may leave blank — and blank is `null`, never `''`.
 *
 * ONE REPRESENTATION OF "NOTHING SAID". A column holding both `''` and `null` for the same fact
 * makes every reader of it write the same two-armed test, and somebody eventually writes only one.
 * The drawer maps an empty textarea to `null`; this schema refuses the empty string so that mapping
 * cannot be forgotten silently.
 */
function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, 'Leave this out entirely rather than sending an empty value.')
    .max(maxLength)
    .nullable()
}

/** A selector or JSON-LD path that is present only when its strategy uses it. */
const selectorSchema = z
  .string()
  .trim()
  .min(1, 'Leave this out entirely rather than sending an empty value.')
  .max(SELECTOR_MAX_LENGTH)

/**
 * Compile an expression, and refuse it if it will not compile.
 *
 * THE COMPILE IS THE CHECK. A pattern that throws here is one that would otherwise throw during a
 * run, inside the drain loop, against a URL nobody chose, at the moment the operator is least able
 * to connect the failure to the field they typed it in. `new RegExp` is the same engine that will
 * match it later, so this is not an approximation of the check — it is the check, run early.
 *
 * The length cap is applied by the caller before this runs, so a pathological expression is bounded
 * before it is ever handed to the engine. A cap and a compile answer different questions: the
 * compile catches "this is not a regex", the cap bounds "this is a regex that never finishes".
 */
function refineCompilable(
  expression: string,
  ctx: z.RefinementCtx,
  path: readonly (string | number)[],
  label: string,
): void {
  try {
    new RegExp(expression)
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      path: [...path],
      message: `${label} is not a valid regular expression: ${
        error instanceof Error ? error.message : 'it could not be compiled.'
      }`,
    })
  }
}

/* --- 4. FEAT §26 fields 13, 14 and 15: the three jsonb shapes ---------------------------------- */

/**
 * FEAT §26 field 13. Where the price is, and how to read the number once found.
 *
 * THE SEPARATORS ARE CONFIGURATION BECAUSE THEY ARE NOT GUESSABLE. `1.234` is one thousand two
 * hundred and thirty-four in one convention and one point two three four in another, and no
 * inspection of the string distinguishes them. Phase 28 parses this text; a wrong guess there
 * produces a price wrong by three orders of magnitude that looks entirely plausible in a comparison
 * table. Stating the convention per source is the only honest way to read it.
 *
 * `currencyOverride` IS FOR A SOURCE THAT PUBLISHES A PRICE WITHOUT SAYING IN WHAT — a bare number
 * beside a symbol the page never disambiguates. It states what the *source* means, and is still
 * never converted; see `currencySchema`.
 */
export const priceExtractionSchema = z
  .object({
    strategy: z.enum(EXTRACTION_STRATEGIES),
    selector: selectorSchema.optional(),
    jsonPath: selectorSchema.optional(),
    currencyOverride: currencySchema.optional(),
    decimalSeparator: z.enum(['.', ',']),
    thousandsSeparator: z.enum(['.', ',', ' ', '']),
  })
  .strict()
  .superRefine((value, ctx) => {
    // A strategy naming a locator, with no locator, is a configuration that reads nothing while
    // looking configured — the failure mode that produces an empty column and no error.
    if (value.strategy === 'SELECTOR' && value.selector === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['selector'],
        message: 'A SELECTOR strategy needs a selector.',
      })
    }
    if (value.strategy === 'JSONLD_PATH' && value.jsonPath === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['jsonPath'],
        message: 'A JSONLD_PATH strategy needs a JSON-LD path.',
      })
    }
    // NONE keeps whatever locator was typed rather than refusing it: turning extraction off in the
    // drawer should not throw away the expression somebody worked out, and an ignored key here is
    // ignored by the adapter too.

    if (value.decimalSeparator === value.thousandsSeparator) {
      ctx.addIssue({
        code: 'custom',
        path: ['thousandsSeparator'],
        message:
          'The decimal and thousands separators must differ; a number using the same character ' +
          'for both cannot be read back.',
      })
    }
  })

export type PriceExtraction = z.infer<typeof priceExtractionSchema>

/**
 * FEAT §26 field 14. Where the SKU is, and what to remove from it.
 *
 * `stripPattern` IS A REGEX AND IS COMPILED HERE for the same reason a URL pattern is: a site whose
 * SKU renders as `SKU: AB-1234` needs the prefix gone, the expression that removes it is typed by a
 * person, and the alternative to compiling it now is discovering it is malformed during a run.
 */
export const skuExtractionSchema = z
  .object({
    strategy: z.enum(EXTRACTION_STRATEGIES),
    selector: selectorSchema.optional(),
    jsonPath: selectorSchema.optional(),
    stripPattern: z.string().trim().min(1).max(URL_PATTERN_MAX_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.strategy === 'SELECTOR' && value.selector === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['selector'],
        message: 'A SELECTOR strategy needs a selector.',
      })
    }
    if (value.strategy === 'JSONLD_PATH' && value.jsonPath === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['jsonPath'],
        message: 'A JSONLD_PATH strategy needs a JSON-LD path.',
      })
    }
    if (value.stripPattern !== undefined) {
      refineCompilable(value.stripPattern, ctx, ['stripPattern'], 'The strip pattern')
    }
  })

export type SkuExtraction = z.infer<typeof skuExtractionSchema>

/**
 * One attribute rule. FEAT §26 field 15's `{ key, selector, kind }`, plus the attribute name that
 * `kind: 'ATTRIBUTE'` cannot work without.
 */
export const attributeRuleSchema = z
  .object({
    key: z.enum(ATTRIBUTE_KEYS),
    selector: selectorSchema,
    kind: z.enum(ATTRIBUTE_RULE_KINDS),
    attribute: z.string().trim().min(1).max(SELECTOR_MAX_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // `ATTRIBUTE` says "read an attribute of the matched element" and the rule has to say which
    // one. Without it the adapter would have to pick — and a rule that guesses which attribute
    // carries a lead time is a rule that quietly reads a tracking id instead.
    if (value.kind === 'ATTRIBUTE' && value.attribute === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['attribute'],
        message: 'An ATTRIBUTE rule must name the attribute to read.',
      })
    }
  })

export type AttributeRule = z.infer<typeof attributeRuleSchema>

/**
 * FEAT §26 field 15. An ORDERED list, read first-match-wins by the Phase 27 adapter.
 *
 * AN ARRAY RATHER THAN AN OBJECT KEYED BY ATTRIBUTE, which is what `0240`'s
 * `research_sources_attribute_extraction_is_array` fixes at the row. Order is the whole semantics:
 * a source may carry three competing selectors for `dimensions` — a specification table, then a
 * bullet list, then the description — and the configuration has to say which is tried first. An
 * object cannot express that, and a "priority" key alongside an object would be an ordering nobody
 * can see by reading the value.
 */
export const attributeExtractionSchema = z.array(attributeRuleSchema).max(MAX_ATTRIBUTE_RULES)

export type AttributeExtraction = z.infer<typeof attributeExtractionSchema>

/* --- 5. The source itself ---------------------------------------------------------------------- */

/**
 * Everything a researcher types about a source, and nothing anybody else decides about it.
 *
 * `policy_status`, `is_enabled`, `policy_reviewed_by`, `policy_reviewed_at` and `policy_notes` are
 * all absent, and their absence is the phase document's "a researcher operates the pipeline, an
 * owner judges it" expressed as a type. `readiness` is present because it is the researcher's own
 * half of that workflow — the request, not the answer. `0240` puts the same separation at the
 * column and says why: one column may not be both.
 *
 * THE HOST MATCH IS NOT ENFORCED HERE, DELIBERATELY. FEAT §26 field 2 asks that `base_url`'s host
 * match every URL pattern's host, and that is a rule about two records — a source and its child
 * rows — which this schema, validating one of them, cannot see. It belongs to the server action
 * that saves both, and to `lib/scraper/core/url-patterns.ts` which owns matching. A cross-record
 * rule half-enforced in the schema for one of the records is worse than one enforced in the single
 * place that holds both, because the half looks like the whole.
 */
export const sourceInputSchema = z
  .object({
    // FEAT §26 field 1. `slug` is `citext unique`; the kebab rule is this schema's, and it is what
    // keeps a slug usable as the path segment `/studio/research/sources/<slug>` and as the search
    // keyword `refresh_research_search_document` indexes it as.
    slug: z
      .string()
      .trim()
      .min(1)
      .max(SLUG_MAX_LENGTH)
      .regex(KEBAB_CASE, 'A slug is lowercase letters, digits and single hyphens.'),
    name: z.string().trim().min(1).max(NAME_MAX_LENGTH),

    // FEAT §26 field 2.
    baseUrl: z
      .string()
      .trim()
      .min(1)
      .max(BASE_URL_MAX_LENGTH)
      .refine((value) => HTTPS_BASE_URL.test(value) || LOOPBACK_BASE_URL.test(value), {
        message:
          'A source is read over https. http is admitted for loopback only, because the tests ' +
          'that prove a request was not made need a fixture server with no certificate.',
      }),

    region: regionSchema,
    currency: currencySchema,

    sourceType: z.enum(SOURCE_TYPES),

    // FEAT §26 field 6. Required HERE though the column is nullable, and `0240` explains the
    // asymmetry: a league is a judgement, so no default may put a classification nobody made on
    // every row — but a source that has been through this form has been through a person, and that
    // person is asked. A row that has never been through the drawer honestly reports nobody knows.
    analyticsLeague: z.enum(ANALYTICS_LEAGUES),

    collectionMode: z.enum(COLLECTION_MODES),

    // FEAT §26 field 11. SHAPE ONLY, AND THE REGISTRY LOOKUP IS SOMEBODY ELSE'S JOB — the Phase 27
    // registry is a server-side module, and this schema is imported by a Client Component. The
    // action that saves a source resolves the key against the registry and records the override
    // tick when `supports()` rejects the base URL; that decision needs an audit row, which is not
    // something a validator can write.
    adapterKey: z
      .string()
      .trim()
      .min(1)
      .max(ADAPTER_KEY_MAX_LENGTH)
      .regex(KEBAB_CASE, 'An adapter key is lowercase letters, digits and single hyphens.'),

    imageExtractionMode: z.enum(IMAGE_EXTRACTION_MODES),

    priceExtraction: priceExtractionSchema,
    skuExtraction: skuExtractionSchema,
    attributeExtraction: attributeExtractionSchema,

    rateLimitRpm: z.number().int().min(RATE_LIMIT_RPM_MIN).max(RATE_LIMIT_RPM_MAX),
    requestDelayMs: z.number().int().min(REQUEST_DELAY_MS_MIN).max(REQUEST_DELAY_MS_MAX),
    concurrency: z.number().int().min(CONCURRENCY_MIN).max(CONCURRENCY_MAX),

    // FEAT §26 field 23. Staff-only; nothing outside Studio reads this column.
    notes: optionalText(NOTES_MAX_LENGTH),

    readiness: z.enum(READINESS_STATES),
  })
  .strict()

export type SourceInput = z.infer<typeof sourceInputSchema>

/* --- 6. FEAT §26 field 10: what a URL of this source looks like -------------------------------- */

/**
 * One URL pattern. A child row, not a key in a blob, so it carries its own constraint and audit
 * trail — and so a reviewer can read it as a table.
 *
 * GLOB IS THE DEFAULT AND REGEX IS OPT-IN, which is where the risk actually lives: a glob cannot
 * backtrack catastrophically and a regex can, against a URL a third party chose. `is_regex` is
 * `false` by default at the column for that reason, so the dangerous case stays rare and
 * deliberate. This schema requires the flag explicitly rather than defaulting it, because a drawer
 * that omits the field should fail rather than silently choose the safe answer on the operator's
 * behalf — the one time it matters is the time somebody meant to tick it.
 *
 * `priority` DOES NOT LET A PRODUCT RULE BEAT AN EXCLUDE. That precedence lives in the matcher, not
 * in this number, because a priority that could invert it would be a way to configure a refusal
 * away.
 */
export const urlPatternInputSchema = z
  .object({
    kind: z.enum(URL_PATTERN_KINDS),
    pattern: z.string().trim().min(1).max(URL_PATTERN_MAX_LENGTH),
    isRegex: z.boolean(),
    priority: z.number().int().min(URL_PATTERN_PRIORITY_MIN).max(URL_PATTERN_PRIORITY_MAX),
    notes: optionalText(NOTES_MAX_LENGTH),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Compiled on save, exactly as the migration's comment on `is_regex` promises. A glob is not
    // compiled here: it is not a regular expression, and handing it to `new RegExp` would accept
    // it as one and quietly change what it means.
    if (value.isRegex) {
      refineCompilable(value.pattern, ctx, ['pattern'], 'The pattern')
    }
  })

export type UrlPatternInput = z.infer<typeof urlPatternInputSchema>

/* --- 7. FEAT §26 field 9: their categories, mapped to Rivya's seven ---------------------------- */

/**
 * One category mapping: a label another site uses, pointed at one of Rivya's categories or
 * explicitly set aside.
 *
 * EXACTLY ONE OF THE TWO, AND THE FORM IS STRICTER THAN THE TABLE IN ONE DIRECTION ONLY. The
 * constraint `research_source_category_map_decides_something` refuses a row that decides *nothing*
 * — `category_id is not null or is_ignored` — so "we have not decided yet" is the absence of a row
 * rather than a row that means nothing. It does not refuse a row that decides *both*, and this
 * schema does, because a mapping that is simultaneously "this is our Seating category" and "this is
 * not something Rivya sells" has no reading a person can act on. The asymmetry is recorded here
 * rather than hidden: a contradictory row is reachable only by a direct SQL write, the mapping
 * reader treats `is_ignored` as final if it ever meets one, and the drawer is where the
 * contradiction is caught before it is stored.
 *
 * `categoryId` IS A POINTER A MEMBER OF STAFF TYPED, not a scraped value — which is the entire
 * basis of amendment A26 admitting the first of exactly two research → public foreign keys. Nothing
 * in the pipeline may write it, and this schema is used by the drawer, never by a worker.
 */
export const categoryMappingInputSchema = z
  .object({
    sourceLabel: z.string().trim().min(1).max(SOURCE_LABEL_MAX_LENGTH),
    // Two labels called the same thing under different parents are two mappings, and the path is
    // how a person tells them apart. Absent when the source showed one.
    sourcePath: optionalText(SOURCE_PATH_MAX_LENGTH),
    categoryId: z.uuid().nullable(),
    isIgnored: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const mapped = value.categoryId !== null
    if (mapped === value.isIgnored) {
      ctx.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: mapped
          ? 'A mapping is either to a category or an explicit ignore, never both.'
          : 'A mapping must choose a category or be marked ignored; undecided is no row at all.',
      })
    }
  })

export type CategoryMappingInput = z.infer<typeof categoryMappingInputSchema>

/* --- 8. FEAT §26 field 19: when it runs -------------------------------------------------------- */

/**
 * One schedule. Six hours minimum, and the arithmetic is `lib/scraper/core/cron.ts`'s.
 *
 * THE SAME RULE IS ENFORCED IN THREE PLACES AND THAT IS NOT DUPLICATION. `research_cron_min_
 * interval_minutes` is the SQL half, in the CHECK `research_source_schedules_min_interval`, and it
 * is the one that holds against a script, a fixture or a hand-written UPDATE. `cronMinIntervalMinutes`
 * is the TypeScript half, and it is what lets the drawer say *why* an expression is refused before
 * the operator submits it. This refinement is the join between them; the two implementations are
 * held to the same answers by `tests/unit/source-schedules.test.ts`.
 *
 * THE MESSAGE NAMES THE COMPUTED INTERVAL because "this schedule is too frequent" is not actionable
 * and "this expression fires every 5 minutes; the minimum is 360" is — it tells the operator both
 * what they asked for and what they may have, and it exposes the parse, so an expression the parser
 * reads differently from the operator is visible rather than mysterious.
 *
 * AN UNREADABLE EXPRESSION IS REFUSED, NOT ASSUMED SAFE. `cronMinIntervalMinutes` returns 0 for
 * anything it cannot parse, for the reason `0240` gives at its own function: a null would make the
 * CHECK `null >= 360`, which is null, which PostgreSQL treats as satisfied — an unparseable
 * expression sailing through the very constraint written to catch it.
 */
export const scheduleInputSchema = z
  .object({
    jobType: z.enum(SCHEDULE_JOB_TYPES),
    cronExpression: z.string().trim().min(1).max(URL_PATTERN_MAX_LENGTH),
    // UTC ONLY, AND SAID OUT LOUD — `research_source_schedules_timezone_supported`. The scheduler
    // evaluates every cron field in UTC, so any other value would be a column it silently ignores.
    // The column exists because FEAT §26 field 19 names it and because the day a zone-aware
    // scheduler lands, the data is already shaped for it.
    timezone: z.literal('UTC'),
    isEnabled: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const intervalMinutes = cronMinIntervalMinutes(value.cronExpression)
    if (intervalMinutes >= MIN_SCHEDULE_INTERVAL_MINUTES) return

    ctx.addIssue({
      code: 'custom',
      path: ['cronExpression'],
      message:
        intervalMinutes <= 0
          ? `This expression cannot be read as five cron fields, so how often it would fire is ` +
            `unknown; a schedule must fire no more often than every ` +
            `${MIN_SCHEDULE_INTERVAL_MINUTES} minutes.`
          : `This expression fires every ${intervalMinutes} minutes; a source may be asked for ` +
            `something no more often than every ${MIN_SCHEDULE_INTERVAL_MINUTES} minutes.`,
    })
  })

export type ScheduleInput = z.infer<typeof scheduleInputSchema>

/* --- 9. FEAT §26 field 22: the policy decision ------------------------------------------------- */

/**
 * What an owner or admin decided about a source, and why.
 *
 * OWNER_VERIFICATION_REQUIRED. This repository cannot determine what a third party's terms permit,
 * and nothing in this file makes that determination — the schema validates the *record* of a
 * judgement a person made, and the review panel carries the standing banner saying so.
 *
 * THE NOTES ARE REQUIRED AND THE MINIMUM LENGTH IS THE POINT. The phase document calls this "a
 * mandatory notes field"; see `POLICY_NOTES_MIN_LENGTH` for why a mandatory field satisfiable by
 * two characters is not one. `RESTRICTED` in particular is meaningless without them — it means
 * approved but limited to specific patterns, and the notes are where the limit is written down.
 *
 * NO REVIEWER, NO TIMESTAMP. `policy_reviewed_by` and `policy_reviewed_at` are the server's to
 * write, from the session and the clock: a form that posted who reviewed a source would be a form
 * that could claim somebody else did.
 */
export const policyDecisionSchema = z
  .object({
    status: z.enum(POLICY_DECISIONS),
    notes: z
      .string()
      .trim()
      .min(
        POLICY_NOTES_MIN_LENGTH,
        `A policy decision is recorded with its reasoning: at least ${POLICY_NOTES_MIN_LENGTH} characters.`,
      )
      .max(NOTES_MAX_LENGTH),
  })
  .strict()

export type PolicyDecision = z.infer<typeof policyDecisionSchema>
