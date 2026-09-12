import type { SeedModule, SeedRecord } from './types'

/**
 * Phase 45: the four strings `ContentCarousel` (RC-222) needs before it may describe itself.
 *
 * WHY THESE ARE ROWS RATHER THAN LITERALS. Three of them are read aloud and nothing else:
 * `aria-roledescription` tells a screen-reader user what kind of thing they have landed in, the
 * position label tells them where they are in it, and the two arrow labels are the buttons' entire
 * accessible names. `scripts/cms/check-section-copy.ts` lists `aria-roledescription` and
 * `aria-label` among the props it refuses a literal in, which is the rule doing its job: a word a
 * person hears is copy, whether or not anybody can see it.
 *
 * THE POSITION CARRIES TOKENS RATHER THAN BEING ASSEMBLED FROM FRAGMENTS, on the rule
 * `catalog-ui.ts` and `search-ui.ts` both state: "3 of 8" is a sentence, and a sentence built from
 * a number, a literal and another number cannot be reworded by an editor or translated by anybody.
 *
 * NONE OF IT ASSERTS ANYTHING ABOUT THE BUSINESS. "Next" is a direction; "carousel" is the name of
 * a widget. `EDITORIAL_COPY`, `NOT_REQUIRED`, published on arrival like every other interface label.
 *
 * A MISSING STRING DEGRADES RATHER THAN BREAKS. With no `roledescription` the row is an ordinary
 * group; with no position label the items carry none; with either arrow label missing there are no
 * arrows and the row still scrolls with a finger, a trackpad and the arrow keys. That is the same
 * rule the WhatsApp link follows — a label nobody wrote is never invented here.
 */
function row(
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

export const carouselUiSeed: SeedModule = {
  name: 'carousel-ui',
  description: 'The four accessible names ContentCarousel (RC-222) reads out.',
  records: [
    row(
      'UI_LABEL',
      'carousel.roledescription',
      'carousel',
      'Carousel role description',
      'Announced after the row’s own name, so a screen-reader user hears what kind of thing it is. Lower case: it is read as part of a sentence, not as a heading.',
    ),
    row(
      'UI_LABEL',
      'carousel.item_position',
      '{{index}} of {{total}}',
      'Carousel item position',
      'The accessible name of one card in a row. {{index}} is 1-based and {{total}} is the number of cards.',
    ),
    row(
      'ACTION_LABEL',
      'carousel.previous',
      'Previous',
      'Carousel — previous',
      'The back arrow’s accessible name. The arrow itself is decorative.',
    ),
    row(
      'ACTION_LABEL',
      'carousel.next',
      'Next',
      'Carousel — next',
      'The forward arrow’s accessible name. The arrow itself is decorative.',
    ),
  ],
}
