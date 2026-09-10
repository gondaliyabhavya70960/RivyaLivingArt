import type { HTMLElement } from 'node-html-parser'

import {
  MAX_LIST_ENTRIES,
  withField,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'
import { resolveJsonLdPath } from '@/lib/scraper/adapters/generic/jsonld'
import { elementText } from '@/lib/scraper/adapters/generic/microdata'
import type { AdapterContext } from '@/lib/scraper/adapters/types'
import {
  attributeExtractionSchema,
  priceExtractionSchema,
  skuExtractionSchema,
  type AttributeRule,
} from '@/lib/scraper/core/source-schema'

/**
 * The source's own configuration — FEAT §26 fields 13, 14 and 15 — read as the fifth strategy.
 *
 * THE THREE BLOBS ARE PARSED WITH THEIR SCHEMAS RATHER THAN TRUSTED, AND THAT IS THE WHOLE POINT OF
 * THIS FILE. `AdapterSourceConfig` types all three as `unknown`, and `types.ts` explains why: they
 * are jsonb columns, so what comes back is whatever was stored — possibly by an older version of
 * `core/source-schema.ts` than the one running now, possibly by a hand-written SQL statement, and
 * in the case of a source configured before Phase 26's form existed, possibly nothing at all. D1
 * says Zod at every trust boundary and a blob read back out of a row is one. A `safeParse` that
 * fails is a configuration this adapter does not act on, logged once with a key and no content, and
 * the next strategy still gets its turn — which is the same outcome as a source that configured
 * nothing, and is the honest one: a rule nobody can read is a rule nobody wrote.
 *
 * IT IS FIFTH, BELOW EVERY PUBLISHED VOCABULARY, AND OPERATORS WILL FIND THAT SURPRISING. A
 * selector somebody typed while looking at the page feels more authoritative than a machine-readable
 * block nobody checked. It is not: a selector is written against one page's markup on one day, and
 * it goes wrong SILENTLY — a redesign moves the price into a different element, the selector matches
 * something else that happens to be there, and the value it reads is plausible. Structured data goes
 * wrong loudly, by disappearing. So the configured selectors are what a page's own vocabulary is
 * measured against when the vocabulary is missing, not the other way round; a source that genuinely
 * needs its selectors to win publishes nothing for them to lose to.
 *
 * A `JSONLD_PATH` RULE RECORDS `'selector'` TOO. `PROVENANCE_STRATEGIES` is a closed list in
 * `draft-schema.ts` and it has one entry for this strategy, because what provenance names is the
 * RULE that produced a value — the source's configuration — rather than the syntax an operator
 * wrote it in. Adding a sixth strategy name for a variant of the fifth would put a distinction in
 * a stored column that nobody downstream has a use for.
 *
 * NOTHING HERE THROWS. A malformed CSS selector makes the parser's matcher throw rather than match
 * nothing, a `stripPattern` that survived the form's compilation check can still be a pathological
 * expression, and both arrive from a column. Each is caught where it happens and costs its own
 * field: see the header on `extract()` in `index.ts` for why an adapter that relies on being caught
 * further out is one that stops being debuggable.
 *
 * `currencyOverride` IS NOT READ, DELIBERATELY. It is the operator's declaration of what a source
 * quotes in — configuration, not evidence — and writing it into `currencyText` would put a
 * statement nobody read off the page into a field whose whole definition is "what one page said".
 * Phase 28 resolves an ambiguous price against the source's currency, which is where a declaration
 * belongs.
 */

/** Read the source's configured price, SKU and attribute rules into a draft. */
export function applyConfiguredSelectors(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  documents: readonly unknown[],
): RawProductDraft {
  let next = draft

  next = applyPrice(next, root, ctx, documents)
  next = applySku(next, root, ctx, documents)
  next = applyAttributes(next, root, ctx, documents)

  return next
}

/** FEAT §26 field 13: where the price is. The separators are Phase 28's to read, not this file's. */
function applyPrice(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  documents: readonly unknown[],
): RawProductDraft {
  const parsed = priceExtractionSchema.safeParse(ctx.source.priceExtraction)
  if (!parsed.success) {
    reportUnreadable(ctx, 'priceExtraction')
    return draft
  }

  const config = parsed.data
  if (config.strategy === 'SELECTOR' && config.selector !== undefined) {
    return withField(draft, 'priceText', firstText(root, config.selector, ctx), 'selector')
  }
  if (config.strategy === 'JSONLD_PATH' && config.jsonPath !== undefined) {
    return withField(
      draft,
      'priceText',
      resolveJsonLdPath(documents, config.jsonPath, ctx),
      'selector',
    )
  }
  // `NONE`, or a strategy whose locator the schema let through as optional: the source has said it
  // does not publish a price this way, and an absent price is a fact rather than a failure.
  return draft
}

/**
 * FEAT §26 field 14: where the SKU is, and what to remove from it.
 *
 * THE STRIP PATTERN IS APPLIED HERE BECAUSE THE CONFIGURATION SAYS SO, and it is the one piece of
 * text-shaping this adapter does. `skuExtractionSchema` documents its purpose in as many words — a
 * site whose SKU renders as `SKU: AB-1234` needs the prefix gone — so removing it is honouring a
 * rule a person wrote about their own source, not a normalisation this file invented. It is
 * compiled inside a try/catch anyway: the form compiled it once on save, and a row can reach this
 * code without ever having been through the form.
 */
function applySku(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  documents: readonly unknown[],
): RawProductDraft {
  const parsed = skuExtractionSchema.safeParse(ctx.source.skuExtraction)
  if (!parsed.success) {
    reportUnreadable(ctx, 'skuExtraction')
    return draft
  }

  const config = parsed.data
  const found =
    config.strategy === 'SELECTOR' && config.selector !== undefined
      ? firstText(root, config.selector, ctx)
      : config.strategy === 'JSONLD_PATH' && config.jsonPath !== undefined
        ? resolveJsonLdPath(documents, config.jsonPath, ctx)
        : null

  if (found === null) return draft
  return withField(draft, 'skuText', stripped(found, config.stripPattern, ctx), 'selector')
}

/**
 * Remove what the source said to remove. An expression that will not compile removes nothing.
 *
 * THE TRY/CATCH IS BELT AND BRACES AND IS WORTH THE THREE LINES ANYWAY. `skuExtractionSchema`
 * compiles the pattern as part of parsing, so a configuration carrying an expression this could
 * throw on has already been refused whole by the `safeParse` above — which is the better outcome,
 * because a SKU still carrying the prefix a source said to remove looks exactly like a SKU. What
 * survives here is the case where the two disagree: this compiles with a flag the schema does not,
 * and a schema that stopped checking would otherwise turn a stored typo into an exception.
 */
function stripped(value: string, pattern: string | undefined, ctx: AdapterContext): string {
  if (pattern === undefined) return value

  let expression: RegExp
  try {
    // GLOBAL, BECAUSE THE SETTING IS "WHAT TO REMOVE FROM IT" RATHER THAN "WHAT TO REMOVE ONCE".
    // A source printing `SKU: AB-1234 (SKU: AB-1234)` in one element is a page doing something
    // odd; leaving the second copy in would still be a SKU nobody can match on.
    expression = new RegExp(pattern, 'g')
  } catch {
    reportUnreadable(ctx, 'skuExtraction.stripPattern')
    return value
  }
  return value.replace(expression, '')
}

/**
 * FEAT §26 field 15: an ORDERED list of rules, read first-match-wins.
 *
 * THE ORDER IS THE WHOLE SEMANTICS, as `attributeExtractionSchema` says: a source may carry three
 * competing selectors for `dimensions` — a specification table, then a bullet list, then the
 * description — and the configuration says which is tried first. `withField` enforces the rest for
 * free: once a key has produced a value, later rules for the same key find the field at confidence
 * 1 and change nothing.
 */
function applyAttributes(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  documents: readonly unknown[],
): RawProductDraft {
  const parsed = attributeExtractionSchema.safeParse(ctx.source.attributeExtraction)
  if (!parsed.success) {
    reportUnreadable(ctx, 'attributeExtraction')
    return draft
  }

  let next = draft
  for (const rule of parsed.data) {
    if (ctx.budgetSpent()) break
    next = applyAttributeRule(next, root, ctx, documents, rule)
  }
  return next
}

/**
 * One rule, written into the field its key names.
 *
 *     dimensions → dimensionTexts      materials     → materialTexts
 *     variants   → variantTexts        customization → customizationTexts
 *     availability → availabilityText  lead_time     → leadTimeText
 *
 * THE SPLIT BETWEEN ONE VALUE AND A LIST IS THE FIELD'S, NOT THE RULE'S. `availability` and
 * `lead_time` are single strings in `RawProductDraft` because a product has one of each; the other
 * four are lists because a specification block has several lines and throwing away all but the
 * first would lose every dimension that was not the width. So a rule whose key is a list key reads
 * EVERY element its selector matches, and one whose key is not reads the first.
 *
 * A SWITCH RATHER THAN A LOOKUP TABLE, AND THE SIX LINES ARE WHAT KEEPS THE `as` OUT. `withField`
 * is generic over the field name, so `withField(draft, 'dimensionTexts', values, …)` refuses a
 * string and `withField(draft, 'leadTimeText', value, …)` refuses a list — at the call site, in the
 * editor. A `Record<AttributeKey, DraftField>` read at runtime loses exactly that connection, and
 * what it buys back is a table this comment already draws. The switch is exhaustive over
 * `ATTRIBUTE_KEYS`, so a seventh key added to that list fails to compile here.
 */
function applyAttributeRule(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  documents: readonly unknown[],
  rule: AttributeRule,
): RawProductDraft {
  switch (rule.key) {
    case 'dimensions':
      return withField(
        draft,
        'dimensionTexts',
        readRuleValues(root, ctx, documents, rule),
        'selector',
      )
    case 'materials':
      return withField(
        draft,
        'materialTexts',
        readRuleValues(root, ctx, documents, rule),
        'selector',
      )
    case 'variants':
      return withField(
        draft,
        'variantTexts',
        readRuleValues(root, ctx, documents, rule),
        'selector',
      )
    case 'customization':
      return withField(
        draft,
        'customizationTexts',
        readRuleValues(root, ctx, documents, rule),
        'selector',
      )
    case 'availability':
      return withField(
        draft,
        'availabilityText',
        firstOf(readRuleValues(root, ctx, documents, rule)),
        'selector',
      )
    case 'lead_time':
      return withField(
        draft,
        'leadTimeText',
        firstOf(readRuleValues(root, ctx, documents, rule)),
        'selector',
      )
  }
}

/** The first of a rule's readings, for a field that holds one. */
function firstOf(values: readonly string[]): string | null {
  return values[0] ?? null
}

/**
 * What one rule reads: text, an attribute, or a JSON-LD path.
 *
 * AN `ATTRIBUTE` RULE READS THE ATTRIBUTE THE RULE NAMES, and `attributeRuleSchema` refuses a rule
 * that names none — its own comment says why: a rule that guessed which attribute carried a lead
 * time is a rule that quietly reads a tracking id instead.
 */
function readRuleValues(
  root: HTMLElement,
  ctx: AdapterContext,
  documents: readonly unknown[],
  rule: AttributeRule,
): readonly string[] {
  if (rule.kind === 'JSONLD_PATH') {
    // The rule's `selector` carries the path in this kind — `attributeRuleSchema` has one locator
    // field and three kinds, so the kind says how to read it.
    const value = resolveJsonLdPath(documents, rule.selector, ctx)
    return value === null ? [] : [value]
  }

  const matches = queryAll(root, rule.selector, ctx)
  const values: string[] = []

  for (const element of matches) {
    if (values.length >= MAX_LIST_ENTRIES) break
    if (ctx.budgetSpent()) break

    const value =
      rule.kind === 'ATTRIBUTE'
        ? (element.getAttribute(rule.attribute ?? '') ?? '').trim()
        : elementText(element)
    if (value !== '') values.push(value)
  }

  return values
}

/** The text of the first element a selector matches, or `null`. */
function firstText(root: HTMLElement, selector: string, ctx: AdapterContext): string | null {
  const first = queryAll(root, selector, ctx)[0]
  if (first === undefined) return null
  const text = elementText(first)
  return text === '' ? null : text
}

/**
 * `querySelectorAll`, made safe for an expression that came out of a column.
 *
 * THE MATCHER THROWS ON A SELECTOR IT CANNOT PARSE rather than matching nothing, and the expression
 * is one a person typed into a drawer months ago. An operator's typo must cost that operator's rule
 * and nothing else — not the item, and certainly not the batch.
 */
function queryAll(
  root: HTMLElement,
  selector: string,
  ctx: AdapterContext,
): readonly HTMLElement[] {
  try {
    return root.querySelectorAll(selector)
  } catch {
    ctx.logger.warn('a configured selector could not be matched and was skipped', {
      length: selector.length,
    })
    return []
  }
}

/**
 * Say that a configured blob could not be read, naming the FIELD and nothing else.
 *
 * NO CONTENT, EVER — `types.ts` is explicit that a log line carries scalars. Here the value is
 * Rivya's own configuration rather than a third party's markup, but the rule is the same one and
 * the field name is what an operator needs to open the right drawer.
 */
function reportUnreadable(ctx: AdapterContext, field: string): void {
  ctx.logger.warn('a source extraction configuration could not be read and was skipped', {
    field,
    source: ctx.source.slug,
  })
}
