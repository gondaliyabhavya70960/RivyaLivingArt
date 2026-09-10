import { emptyDraft, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import type { DiscoveredUrl, SourceAdapter } from '@/lib/scraper/adapters/types'

/**
 * The second of the two vendor adapter folders FEAT §27 names. Identical in every respect to
 * `../source-a/index.ts`, which carries the reasoning.
 *
 * THIS HEADER IS SHORT DELIBERATELY, AND THE BREVITY IS THE DECISION. There is one argument behind
 * both folders — placeholder names that name nobody, a `supports()` that refuses everything, an
 * `extract()` that returns an empty draft rather than throwing, no capability claimed and no
 * external host anywhere — and it is written out once, next door. Two copies of one argument drift,
 * and the copy that drifts is the one somebody happens to open; a pointer cannot.
 *
 * THE FOUR RULES, RESTATED SO THIS FILE IS NOT A RIDDLE:
 *
 *   1. `source-b` IS THE REQUIREMENT'S OWN PLACEHOLDER NAME. It stands for no company. D10 forbids
 *      naming a competitor anywhere in this repository, and an adapter is where one would first
 *      appear — so `scripts/research/check-research-isolation.mjs` fails the build on an external
 *      host under `lib/scraper/adapters/**`, and the contract suite asserts it too.
 *   2. `supports()` RETURNS FALSE, which is what makes an unfinished adapter unselectable rather
 *      than merely undocumented.
 *   3. `extract()` RETURNS AN EMPTY DRAFT. A throw would say "this adapter is broken" where the
 *      true statement is "these rules did not fit this page", and it would spend a source's
 *      ten-failure abort budget saying it.
 *   4. A REAL VENDOR ADAPTER IS THE OWNER'S TO ADD, after that source has passed policy review.
 *      `README.md` beside this file says how.
 *
 * WHY THERE ARE TWO OF THESE AT ALL: the requirement's tree shows two, and it shows two in order to
 * say that vendor adapters are plural — that the architecture expects several and that adding the
 * second must not touch `lib/scraper/core/**`. One folder would have read as a special case.
 */

/** As `SOURCE_A_ADAPTER_KEY`: `KEBAB_CASE`, and named once rather than repeated as a literal. */
export const SOURCE_B_ADAPTER_KEY = 'source-b'

/** Nothing, in the shape of a `SourceAdapter`. `0.0.0` says nothing has shipped, because nothing has. */
export const sourceBAdapter: SourceAdapter = {
  key: SOURCE_B_ADAPTER_KEY,
  version: '0.0.0',
  capabilities: [],
  supports: () => false,
  discover: async (): Promise<readonly DiscoveredUrl[]> => [],
  // A fresh draft per call, for the reason `../source-a/index.ts` gives.
  extract: async (): Promise<RawProductDraft> => emptyDraft(),
}
