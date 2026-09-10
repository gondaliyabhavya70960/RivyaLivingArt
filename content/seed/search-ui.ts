import type { SeedModule, SeedRecord } from './types'

/**
 * Phase 23: the words the search results page and the header combobox use.
 *
 * SEED §26 ALREADY SEEDED THE THREE STRINGS THIS PAGE HAD WHEN IT COULD NOT SEARCH — the field's
 * placeholder, the no-results heading and its body. Those stay exactly as they are; nothing here
 * touches them, because Phase 23's promise is that the page which said "nothing matched" honestly
 * now says it accurately, in the same words.
 *
 * WHAT IS NEW IS A GROUP HEADING PER ENTITY TYPE and the announcements a screen-reader user hears.
 * All of it is EDITORIAL_COPY and none of it asserts anything: "Products" is a label for a list,
 * not a claim that products exist — an empty group is not rendered at all.
 *
 * THE COUNTS CARRY TOKENS RATHER THAN BEING BUILT FROM FRAGMENTS, on the rule `catalog-ui.ts`
 * states: "12 results for resin" is a sentence, and a sentence assembled from three literals and a
 * number cannot be reworded by an editor or translated by anyone.
 *
 * THE FOUR RULE REASONS ARE HERE TOO, and they are the most important rows in the module. A
 * suggestion an editor cannot interrogate is a recommendation engine wearing a workspace's clothes;
 * each of these sentences says exactly what the rule observed, so an editor can disagree with it.
 */
function uiRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:UI_LABEL.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'UI_LABEL',
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

function actionRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:ACTION_LABEL.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'ACTION_LABEL',
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

export const searchUiSeed: SeedModule = {
  name: 'search-ui',
  description:
    'Phase 23 search: the five result-group headings, the near-match heading, the result-count announcements, the combobox instructions, and the four relationship-rule reasons.',
  records: [
    // --- result groups, in the order the page renders them ---------------------------------------
    uiRow(
      'search.group.product',
      'Pieces',
      'Search results — products group',
      'The heading above product results on /search. "Pieces" rather than "Products" because that is what the rest of the site calls them. Absent when nothing matched in this group — an empty group is not rendered.',
    ),
    uiRow(
      'search.group.collection',
      'Collections',
      'Search results — collections group',
      'The heading above collection results on /search. Collections still in concept are never indexed, so this group only ever lists confirmed ones.',
    ),
    uiRow(
      'search.group.category',
      'Categories',
      'Search results — categories group',
      'The heading above category results on /search.',
    ),
    uiRow(
      'search.group.portfolio_project',
      'Projects',
      'Search results — portfolio group',
      'The heading above delivered-project results on /search.',
    ),
    uiRow(
      'search.group.journal_article',
      'Journal',
      'Search results — journal group',
      'The heading above article results on /search.',
    ),

    // --- the near-match band ----------------------------------------------------------------------
    uiRow(
      'search.similar.heading',
      'Close matches',
      'Search results — near-match heading',
      'The heading above results found by spelling similarity rather than by an exact word match. They are shown under their own heading, never mixed into the groups above, so nobody reads a near match as an exact one. Absent unless the exact search found fewer than four things.',
    ),
    uiRow(
      'search.similar.body',
      'Nothing matched exactly, so these are the closest names we hold.',
      'Search results — near-match explanation',
      'Sits under the near-match heading and says plainly why these results are here. It claims nothing about the catalogue beyond what was actually searched.',
    ),

    // --- announcements ---------------------------------------------------------------------------
    uiRow(
      'search.count',
      '{{count}} results for {{query}}',
      'Search results — count announcement',
      'Read aloud by a screen reader when results arrive, and shown above the groups. {{count}} and {{query}} are substituted at render time. The whole sentence lives here because a count sentence cannot be rebuilt from fragments in another language.',
    ),
    uiRow(
      'search.count.one',
      '1 result for {{query}}',
      'Search results — single-result announcement',
      'The singular form of the count sentence. A separate row rather than a rule in code: which counts need a separate form is a property of the language, not of the software.',
    ),
    uiRow(
      'search.count.none',
      'No results for {{query}}',
      'Search results — zero-result announcement',
      'What a screen reader hears when nothing matched. The visible copy in that case is SEED §26 EMPTY_STATE.search.heading and .body, which are untouched by Phase 23.',
    ),

    // --- the combobox ------------------------------------------------------------------------------
    uiRow(
      'search.suggestions.label',
      'Search suggestions',
      'Header search — suggestion list name',
      'Never shown on screen. Names the suggestion list that opens under the header search box, so a screen reader can tell it from the page behind it.',
    ),
    uiRow(
      'search.suggestions.hint',
      'Type two characters or more. Use the up and down arrows to move through suggestions.',
      'Header search — keyboard instructions',
      'Read once when focus reaches the search box. It describes how the control works; it does not describe the catalogue.',
    ),
    actionRow(
      'search.see_all',
      'See all results',
      'Header search — see-all option',
      'The last option in the suggestion list. Submits the search and goes to the full results page.',
    ),
    actionRow(
      'search.see_more_in_group',
      'See all {{count}} in {{group}}',
      'Search results — per-group see-all link',
      'The link under a result group that holds more than the ten shown. Both tokens are substituted at render time.',
    ),

    // --- the four relationship rules ------------------------------------------------------------------
    uiRow(
      'relations.rule.same_collection',
      'Both pieces are in the same collection.',
      'Relationship suggestion — same collection',
      'Shown in the Suggestions panel of /studio/catalog/relationships. It states what the rule observed and nothing more: an editor put both pieces in that collection, so the connection was already made by hand once. The collection is named beside it as evidence.',
    ),
    uiRow(
      'relations.rule.shared_materials',
      'These two pieces are made from at least two of the same materials.',
      'Relationship suggestion — shared materials',
      'Shown in the Suggestions panel. Two shared materials is the threshold, not one: almost everything here contains resin, so a single shared material would connect the whole catalogue to itself. The shared materials are named beside it.',
    ),
    uiRow(
      'relations.rule.journal_linked_product',
      'A published article links to this piece.',
      'Relationship suggestion — journal link',
      'Shown in the Suggestions panel. The rule found an actual link to this product in the article, typed by whoever wrote it. It does not fire on a title mention.',
    ),
    uiRow(
      'relations.rule.project_featured_product',
      'A published project already points at this piece, but this piece does not point back.',
      'Relationship suggestion — project inverse',
      'Shown in the Suggestions panel. The rule adds no judgement of its own: somebody made the forward connection by hand and this offers to close it.',
    ),
    uiRow(
      'relations.coverage',
      '{{count}} published pieces have no hand-made connections yet.',
      'Relationships workspace — coverage note',
      'Shown at the top of /studio/catalog/relationships. A count of work still to do, not a warning: a piece with no connections renders the honest "More in {Category}" fallback, which is a correct page rather than a broken one.',
    ),
  ],
}
