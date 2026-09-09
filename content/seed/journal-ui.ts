import type { SeedModule, SeedRecord } from './types'

/**
 * The words the journal's own controls use.
 *
 * A MODULE OF ITS OWN, FOLLOWING `catalog-ui.ts` AND `portfolio-ui.ts` FOR THE SAME REASON. None of
 * these sentences is quoted from the specification; every one of them names a control this phase
 * invented — a category chip row, a reading-time estimate, the heading over a related strip. Keeping
 * them separate from `global.ts` is what lets a reader see at a glance which strings came from SEED
 * and which from a component, and D2 leaves no room for typing them into JSX:
 * `scripts/cms/check-section-copy.ts` fails the build over exactly that.
 *
 * SEED §29's EMPTY STATE IS NOT HERE. `EMPTY_STATE.journal` is a Phase 08 row seeded by
 * `global-content.ts` with §29's wording — *More from the studio soon.* — and the journal's
 * `empty-state` block reads it by key, exactly as `/portfolio` reads §28's. Restating it would give
 * the owner two rows to edit and one of them would go stale.
 *
 * `journal.reading_time` IS A SENTENCE WITH A PLACEHOLDER, not three nodes glued together in JSX,
 * for the reason `product.gallery.position` gives: an owner must be able to reword it — or drop the
 * word "read" — without a code change, and a language that puts the number last must be able to.
 *
 * IT IS ALSO DELIBERATELY HEDGED. 200 words per minute is a convention, not a measurement of the
 * person reading, so the string says "min read" over a derived estimate rather than promising a
 * duration. An article with no body has no estimate at all and the card shows nothing.
 *
 * EVERY ROW IS `EDITORIAL_COPY` / `NOT_REQUIRED` AND SEEDS PUBLISHED. They name controls; a filter
 * chip with no name is not a filter, and gating the journal's navigation behind owner verification
 * would make the listing unusable while telling the owner nothing they could act on.
 */

/**
 * `global:UI_LABEL.<key>`, FOLLOWING `portfolio-ui.ts` AND `product-detail-ui.ts` RATHER THAN
 * `catalog-ui.ts`. Phase 14 gave its listing controls a `catalog:` namespace of their own; Phases 15
 * and 17 did not, and the newer convention is the better one — the seed-key prefix says which TABLE
 * a key addresses, and every row in all three modules addresses `global_content`. A fourth prefix
 * would make `journal:` and `journal-article:` sit one character apart while pointing at different
 * tables, which is exactly the confusion `seed-modules.test.ts` records for `collection:`.
 */
function journalRow(
  group: 'UI_LABEL' | 'ACTION_LABEL',
  key: string,
  value: string,
  label: string,
  description: string,
): SeedRecord {
  return {
    seedKey: `global:${group}.${key}`,
    table: 'global_content',
    fields: {
      group_key: group,
      key,
      label,
      value,
      description,
      is_enabled: true,
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}

export const journalUiSeed: SeedModule = {
  name: 'journal-ui',
  description: 'Phase 18 journal controls: category chips, reading time, related headings.',
  records: [
    journalRow(
      'UI_LABEL',
      'journal.categories',
      'Categories',
      'Journal category filter — region name',
      'The accessible name of the row of category links on /journal. Without it a screen reader announces a row of unexplained links.',
    ),
    journalRow(
      'UI_LABEL',
      'journal.categories.all',
      'All writing',
      'Journal category filter — the unfiltered option',
      'The first chip, which clears the category filter. Deliberately not "All" on its own, which reads as a category called All.',
    ),
    journalRow(
      'UI_LABEL',
      'journal.reading_time',
      '{{minutes}} min read',
      'Journal card — reading time',
      'Rendered from a derived estimate at 200 words per minute. A whole sentence rather than a number beside a word, so it can be reworded or reordered without a code change. An article with no body has no estimate and this is not shown.',
    ),
    journalRow(
      'UI_LABEL',
      'journal.byline',
      'Written by {{name}}',
      'Article page — byline',
      'Above or below the standfirst on an article. The name is journal_articles.byline, which defaults to the studio itself; a person’s name there requires owner verification.',
    ),
    journalRow(
      'UI_LABEL',
      'journal.related.curated',
      'Related',
      'Article page — curated relations heading',
      'Used ONLY for links an editor made by hand. Never for the automatic same-category fill, which has its own heading and its own key.',
    ),
    journalRow(
      'UI_LABEL',
      'journal.related.same_category',
      'More in {{category}}',
      'Article page — same-category fallback heading',
      'Used when an article has fewer than three curated links. It states a fact — these pieces share a category — rather than implying a judgement nobody made, which is why it is deliberately not "Related" or "You may also like".',
    ),
    journalRow(
      'UI_LABEL',
      'journal.results',
      'Articles',
      'Journal listing — region name',
      'The accessible name of the list of articles on /journal and on a category page.',
    ),
    journalRow(
      'UI_LABEL',
      'journal.pagination',
      'Journal pages',
      'Journal listing — pagination region name',
      'Distinct from the catalogue’s pagination label so a screen-reader user moving by region hears which listing they are in.',
    ),
    journalRow(
      'UI_LABEL',
      'journal.pagination.position',
      'Page {{page}} of {{pages}}',
      'Journal listing — position in the sequence',
      'Shown below 430px in place of the number strip, where eleven page numbers is a control nobody can hit.',
    ),
  ],
}
