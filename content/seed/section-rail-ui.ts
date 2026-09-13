import type { SeedModule, SeedRecord } from './types'

/**
 * The one string `SectionRail` (RC-245) needs before it may exist.
 *
 * WHY A ROW RATHER THAN A LITERAL. The rail is a `<nav>`, and a second navigation landmark on a
 * page is only usable if it has a name — otherwise a screen-reader user moving between landmarks
 * hears "navigation" twice and has to enter one to find out which is which. That name is read
 * aloud and nothing else, which is exactly the class of string
 * `scripts/cms/check-section-copy.ts` refuses a literal for: a word a person hears is copy, whether
 * or not anybody can see it.
 *
 * A MISSING STRING MEANS NO RAIL, NOT AN UNNAMED ONE. `SectionRail` returns null when this row is
 * absent, on the rule the WhatsApp link and the carousel arrows already follow — a label nobody
 * wrote is never invented here, and an unnamed duplicate landmark is worse than no landmark.
 *
 * IT ASSERTS NOTHING ABOUT THE BUSINESS. "On this page" names a widget and describes the document,
 * not Rivya. `EDITORIAL_COPY`, `NOT_REQUIRED`, published on arrival like every other interface
 * label.
 *
 * THE NUMBERS BESIDE EACH ENTRY ARE NOT HERE, and deliberately. "01", "02" are generated from the
 * rail's own order, so they are not copy in any language and there is nothing for an editor to
 * translate or get out of step with the list. The LABELS are not here either: each comes from that
 * section's own `eyebrow` column, so the rail is edited where the section is edited.
 */
function row(
  group: 'UI_LABEL',
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

export const sectionRailUiSeed: SeedModule = {
  name: 'section-rail-ui',
  description: 'The accessible name of the page-section index rail (RC-245).',
  records: [
    row(
      'UI_LABEL',
      'section_rail.label',
      'On this page',
      'Section rail — landmark name',
      'Names the second navigation landmark on a long page, so a screen-reader user can tell it from the site header. Describes the document rather than the business.',
    ),
  ],
}
