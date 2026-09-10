import { isSafeHttpUrl } from '@/lib/catalog/validation'
import type { RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import type { NormalizationSignals, NormalizedProduct } from '@/lib/scraper/normalization'

/**
 * FEAT §21's data-quality rules, applied to somebody else's page.
 *
 * **EVERY RULE RUNS BEFORE THE WRITE, AND THE DATABASE CONSTRAINTS ARE BACKSTOPS.** That ordering is
 * the whole design and it is easy to get backwards. `research_price_state_coherent` and
 * `research_dimensions_sane` would each refuse an offending row outright — and a refused INSERT is
 * a row that vanishes, or a pipeline that crashes holding its leases, not a row somebody can see
 * and fix. So the normalizer refuses the VALUE (nulls it, states why) and these rules attach the
 * ERROR, and the row is written, kept at `VALIDATED`, listed in the explorer's Issues view and
 * counted on the dashboard. The constraint then fires for a hand-written `UPDATE` and for nothing
 * else, which is exactly what a backstop is for.
 *
 * A BLOCKED ROW IS NEVER DELETED, NEVER SILENTLY DROPPED AND NEVER QUIETLY PROMOTED. `blocks` on an
 * ERROR means "this row does not move past VALIDATED while the issue stands", and the issue stands
 * until the page changes or a person dismisses it with a reason. Both are visible.
 *
 * THE URL PREDICATE IS THE FIRST-PARTY ONE, IMPORTED. `lib/catalog/validation.ts` owns
 * `isSafeHttpUrl` because Rivya's own editors type addresses into forms; a second copy here would
 * be a second place for `javascript:` to be admitted, and the two would drift the first time either
 * was tightened. `tests/unit/validation-rules.test.ts` asserts the shared predicate is the one in
 * use.
 */

export const ISSUE_SEVERITIES = ['ERROR', 'WARNING', 'INFO'] as const
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number]

/** The eleven, in the phase document's own order. The array IS the registry. */
export const RESEARCH_VALIDATION_RULES = [
  'missing_title',
  'malformed_source_url',
  'non_https_url',
  'price_quote_with_amount',
  'price_zero_or_negative',
  'impossible_dimension',
  'dimension_ambiguous',
  'currency_ambiguous',
  'duplicate_source_url_within_source',
  'missing_category_mapping',
  'image_url_unreachable_shape',
  'low_confidence_extraction',
] as const

export type ResearchValidationRule = (typeof RESEARCH_VALIDATION_RULES)[number]

/**
 * What each rule is, once, so a screen can label it and a test can walk the set.
 *
 * `blocks` IS DERIVED FROM `severity` AND STORED ANYWAY. Every ERROR blocks today and it is
 * tempting to leave it implied — but "blocks promotion" is a product decision and "this is serious"
 * is a display decision, and the day an ERROR should be visible without holding a row back, the
 * distinction has to already exist or the change is a rewrite. `tests/unit/validation-rules.test.ts`
 * asserts they agree today.
 */
export interface RuleDefinition {
  readonly rule: ResearchValidationRule
  readonly severity: IssueSeverity
  readonly blocks: boolean
  /** Which of `NORMALIZED_FIELDS`/draft fields it concerns, for the explorer's per-field display. */
  readonly field: string | null
}

export const RULE_DEFINITIONS: Readonly<Record<ResearchValidationRule, RuleDefinition>> = {
  missing_title: { rule: 'missing_title', severity: 'ERROR', blocks: true, field: 'title' },
  malformed_source_url: {
    rule: 'malformed_source_url',
    severity: 'ERROR',
    blocks: true,
    field: 'source_url',
  },
  non_https_url: { rule: 'non_https_url', severity: 'ERROR', blocks: true, field: 'source_url' },
  price_quote_with_amount: {
    rule: 'price_quote_with_amount',
    severity: 'ERROR',
    blocks: true,
    field: 'price',
  },
  price_zero_or_negative: {
    rule: 'price_zero_or_negative',
    severity: 'ERROR',
    blocks: true,
    field: 'price',
  },
  impossible_dimension: {
    rule: 'impossible_dimension',
    severity: 'ERROR',
    blocks: true,
    field: 'dimensions',
  },
  dimension_ambiguous: {
    rule: 'dimension_ambiguous',
    severity: 'WARNING',
    blocks: false,
    field: 'dimensions',
  },
  currency_ambiguous: {
    rule: 'currency_ambiguous',
    severity: 'WARNING',
    blocks: false,
    field: 'currency',
  },
  duplicate_source_url_within_source: {
    rule: 'duplicate_source_url_within_source',
    severity: 'ERROR',
    blocks: true,
    field: 'source_url',
  },
  missing_category_mapping: {
    rule: 'missing_category_mapping',
    severity: 'WARNING',
    blocks: false,
    field: 'categories',
  },
  image_url_unreachable_shape: {
    rule: 'image_url_unreachable_shape',
    severity: 'INFO',
    blocks: false,
    field: 'images',
  },
  low_confidence_extraction: {
    rule: 'low_confidence_extraction',
    severity: 'WARNING',
    blocks: false,
    field: null,
  },
}

export interface ResearchIssue {
  readonly rule: ResearchValidationRule
  readonly severity: IssueSeverity
  readonly field: string | null
  /** One sentence, naming what was seen. Rendered in the explorer beside the source text. */
  readonly detail: string
}

/**
 * Everything the eleven rules need, and nothing they could use to reach the network.
 *
 * `duplicateOfEarlierId` AND `categoryMapped` ARE ANSWERS, NOT CLIENTS. Both are questions about
 * other rows, and passing a database handle in so a rule could ask them itself would make this
 * module impure and every rule un-runnable in a unit test. `workflows/promote.ts` asks; the rules
 * judge.
 */
export interface ValidationInput {
  readonly draft: RawProductDraft
  readonly normalized: NormalizedProduct
  readonly signals: NormalizationSignals
  /** `research_products.source_url` — where the bytes came from, not what the page claimed. */
  readonly sourceUrl: string
  /** An OLDER row in the same source with the same URL. The older row wins; this one is blocked. */
  readonly duplicateOfEarlierId: string | null
  /** Whether the category map or a keyword rule resolved a Rivya category for this row. */
  readonly categoryMapped: boolean
}

/** Under three fields found is FEAT §27's own threshold, and it is a warning, not a failure. */
export const LOW_CONFIDENCE_FIELDS = 3

function issue(rule: ResearchValidationRule, detail: string): ResearchIssue {
  const definition = RULE_DEFINITIONS[rule]
  return { rule, severity: definition.severity, field: definition.field, detail }
}

/**
 * A reference that begins like an address and is not one.
 *
 * **NO REQUEST IS MADE, AND THAT IS WHY THE RULE IS INFO.** Checking whether a competitor's image
 * URL resolves would mean fetching it — traffic to a third party outside the politeness posture,
 * from a job that is not a crawl, at a rate nobody configured. So the rule reads the string and
 * says only what a string can say. Whether it serves anything is not asked, and the severity says
 * so.
 *
 * WHAT IT ACTUALLY CATCHES IS NARROWER THAN "NOT AN HTTP URL", AND THAT IS WORTH BEING PRECISE
 * ABOUT. `rawProductDraftSchema` already refuses anything not beginning `http://` or `https://` —
 * `data:`, `javascript:` on a lazy-loading gallery, a bare path — so a draft cannot carry one and a
 * rule written to catch them would be unreachable, which is the failure this phase's own risk table
 * names. What survives that filter and is still not an address is a REFERENCE THE PAGE BUILT
 * WRONGLY: `https://` with no host, a URL with an unescaped space in it, a bracket a template left
 * open. Those are real, they come from a broken template on the source, and they are worth one INFO
 * line rather than a silent empty image column.
 */
function badImageShape(urls: readonly string[]): string[] {
  return urls.filter((url) => !isSafeHttpUrl(url))
}

/** Every rule, evaluated. Pure — no I/O, no clock, no randomness. */
export function evaluateRules(input: ValidationInput): readonly ResearchIssue[] {
  const issues: ResearchIssue[] = []
  const { normalized, signals } = input

  if (normalized.titleNormalized === null) {
    issues.push(issue('missing_title', 'The page gave no title, so the row cannot be recognised.'))
  }

  if (!isSafeHttpUrl(input.sourceUrl)) {
    issues.push(
      issue(
        'malformed_source_url',
        `“${input.sourceUrl.slice(0, 120)}” is not an http(s) address.`,
      ),
    )
  } else if (!input.sourceUrl.toLowerCase().startsWith('https://')) {
    /*
     * A SEPARATE RULE FROM `malformed_source_url` BECAUSE IT IS A DIFFERENT PROBLEM. A malformed
     * URL is a broken extraction; a plain-http URL is a page read over a channel anybody on the
     * path could have rewritten, which makes every value on the row unattributable to the source.
     * Both block, and telling them apart is what lets an operator fix the right thing. The loopback
     * exception `research_sources` makes for fixture servers does not apply here: a fixture server
     * is not a source anybody quarantines.
     */
    issues.push(
      issue(
        'non_https_url',
        'The page was read over plain http; its contents are not attributable.',
      ),
    )
  }

  if (signals.priceQuoteCarriedAmount) {
    issues.push(
      issue(
        'price_quote_with_amount',
        'The page printed a number beside a quote-only posture. The posture was kept and the ' +
          'number was not, because a row cannot hold both.',
      ),
    )
  }

  if (signals.priceZeroOrNegative) {
    issues.push(
      issue(
        'price_zero_or_negative',
        'The page printed a price of nought or less, which was not stored.',
      ),
    )
  }

  if (signals.dimensionImpossible) {
    issues.push(
      issue(
        'impossible_dimension',
        'A measurement fell outside 10–10 000 mm, which is a misread unit far more often than a ' +
          'real object. The reading was discarded and the source text kept.',
      ),
    )
  }

  if (signals.dimensionAmbiguous) {
    issues.push(
      issue(
        'dimension_ambiguous',
        'A measurement had no unit, and no unit is inferred from magnitude. The row is excluded ' +
          'from scale bands.',
      ),
    )
  }

  if (signals.currencyAmbiguous) {
    issues.push(
      issue(
        'currency_ambiguous',
        'The page used a currency sign more than one currency shares. The row is excluded from ' +
          'price comparisons.',
      ),
    )
  }

  if (input.duplicateOfEarlierId !== null) {
    issues.push(
      issue(
        'duplicate_source_url_within_source',
        'Another row in this source already holds this address. The older row wins.',
      ),
    )
  }

  if (!input.categoryMapped) {
    issues.push(
      issue(
        'missing_category_mapping',
        'No category map row or keyword rule matched this page. The row stops at VALIDATED rather ' +
          'than being given a category nobody chose.',
      ),
    )
  }

  const badImages = badImageShape(normalized.imageUrls)
  if (badImages.length > 0) {
    issues.push(
      issue(
        'image_url_unreachable_shape',
        `${String(badImages.length)} image address${badImages.length === 1 ? ' is' : 'es are'} not a ` +
          'well-formed http(s) URL. No request was made to check.',
      ),
    )
  }

  if (signals.confidentFieldCount < LOW_CONFIDENCE_FIELDS) {
    issues.push(
      issue(
        'low_confidence_extraction',
        `The adapter found ${String(signals.confidentFieldCount)} field${
          signals.confidentFieldCount === 1 ? '' : 's'
        } of the fifteen it looks for. A page that published little is not a page that was read wrongly.`,
      ),
    )
  }

  return issues
}

/** Does anything here hold the row back? */
export function blocksPromotion(issues: readonly ResearchIssue[]): boolean {
  return issues.some((entry) => RULE_DEFINITIONS[entry.rule].blocks)
}

/** The blocking rules, for a screen that has to say WHY a row stopped. */
export function blockingRules(issues: readonly ResearchIssue[]): readonly ResearchValidationRule[] {
  return issues.filter((entry) => RULE_DEFINITIONS[entry.rule].blocks).map((entry) => entry.rule)
}
