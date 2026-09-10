import { emptyDraft, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import type { DiscoveredUrl, SourceAdapter } from '@/lib/scraper/adapters/types'

/**
 * The first of the two vendor adapter folders FEAT §27 names, holding an adapter that supports
 * nothing and extracts nothing — on purpose, and for as long as this repository is public.
 *
 * `source-a` NAMES NOBODY, AND THAT IS THE WHOLE REASON THE FOLDER LOOKS LIKE THIS. The requirement
 * draws the adapter tree as `source-a/`, `source-b/` and `generic/`, and those first two are its
 * own placeholder names rather than a shorthand for two companies whose real names belong here
 * instead. D10 is absolute: no competitor, brand, domain or price appears anywhere in this
 * repository. An adapter is where one would first appear, because the fastest way to make a vendor
 * adapter work is to put the site's host in a `supports()` predicate — so
 * `scripts/research/check-research-isolation.mjs` greps every file under
 * `lib/scraper/adapters/**` for an external host and fails the build on one, and
 * `tests/unit/adapter-contract.test.ts` asserts the same rule where a developer sees it first.
 *
 * `supports()` RETURNS FALSE UNCONDITIONALLY, WHICH IS WHAT KEEPS AN UNFINISHED ADAPTER
 * UNSELECTABLE. It is the one line that has to be right in a placeholder: a predicate that answered
 * "yes" — even for a single URL shape somebody was testing against — would let a source be
 * configured for rules that do not exist, and the failure would arrive as a nightly run that
 * fetches politely and produces nothing, with nothing anywhere saying why. It takes no argument at
 * all rather than ignoring one, which is a stronger statement than it looks: there is no source in
 * scope for it to be tempted to branch on, so the predicate cannot become half-written by accident.
 *
 * `extract()` RETURNS AN EMPTY DRAFT RATHER THAN THROWING, AND THE DIFFERENCE IS A DIAGNOSIS. FEAT
 * §27 asks that `extract()` never throw on input it cannot read and return a low-confidence draft
 * instead, because the two outcomes mean different things to whoever reads the run: an empty draft
 * says the adapter's rules did not fit this page, and a thrown error says the adapter is broken. A
 * placeholder that threw would be the second statement about a folder whose only true statement is
 * the first — and every such throw would count towards the ten consecutive failures that abort a
 * source and, three runs later, open its circuit, punishing a source whose only problem is that
 * nobody has written its rules yet. Nothing can reach this in practice: `supports()` is false and
 * `adapters/registry.ts` publishes no descriptor for this key, so no source can be configured to
 * it. What the empty draft is actually for is the shared contract suite, which runs every
 * registered adapter over malformed input and asserts a draft comes back.
 *
 * `capabilities` IS EMPTY, AND THAT IS THE HONEST CLAIM. `DISCOVER`, `EXTRACT` and `PAGINATE` are
 * three separate promises about what an adapter can do, and this one does none of them.
 * Advertising `EXTRACT` here would also put the folder under the contract suite's fixture rule —
 * three golden fixtures per extracting adapter, one of them malformed — which for a placeholder
 * would mean inventing three pages from a site that does not exist in order to prove that nothing
 * is read from them. The exemption is asserted explicitly in `tests/unit/adapter-contract.test.ts`
 * rather than left as a gap in the loop.
 *
 * HOW A REAL ONE ARRIVES IS IN `README.md` BESIDE THIS FILE, and the short version is that it is
 * the owner's to add, in a deployment of their own, after that source has passed policy review —
 * at which point the host lives in `research_sources.base_url`, a row somebody approved, and never
 * in a build artefact.
 */

/**
 * The key this adapter would register under. `KEBAB_CASE`, as `core/source-schema.ts` requires of
 * `research_sources.adapter_key`, and exported so that the registration in `adapters/execution.ts`
 * and the assertions in the contract suite name it once rather than repeating a literal.
 */
export const SOURCE_A_ADAPTER_KEY = 'source-a'

/**
 * Nothing, in the shape of a `SourceAdapter`.
 *
 * THE VERSION IS `0.0.0` BECAUSE SEMVER ALREADY HAS A WAY TO SAY "NOTHING HAS SHIPPED". It matters
 * more here than it would elsewhere: a version is provenance, written onto every
 * `research_raw_items` and `research_product_versions` row an adapter produces, so the first real
 * version should be a number somebody chose when they wrote the rules — not `1.0.0` inherited from
 * a placeholder that read nothing.
 */
export const sourceAAdapter: SourceAdapter = {
  key: SOURCE_A_ADAPTER_KEY,
  version: '0.0.0',
  capabilities: [],
  supports: () => false,
  discover: async (): Promise<readonly DiscoveredUrl[]> => [],
  // A FRESH DRAFT PER CALL, NOT A SHARED CONSTANT. `emptyDraft()` parses a fifteen-field object, so
  // the cost is nothing, and handing every item the same object identity is the kind of shortcut
  // that is invisible until something downstream keeps a reference to "its" draft.
  extract: async (): Promise<RawProductDraft> => emptyDraft(),
}
