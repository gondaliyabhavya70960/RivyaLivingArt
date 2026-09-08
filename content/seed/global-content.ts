import type { SeedModule } from './types'

/**
 * The site-wide strings the CMS engine itself requires.
 *
 * `lib/cms/strings.ts` SHIPS NO FALLBACKS. A missing key renders nothing at all on the public
 * site, deliberately: a default in code would put a sentence on the page that nobody wrote, which
 * is SEED §55's failure, and it would do it invisibly because the page would look finished. That
 * makes these rows load-bearing rather than cosmetic — without them a hero whose asset fails to
 * resolve shows an unlabelled well, and `/portfolio` shows nothing where its explanation belongs.
 *
 * TWO KINDS OF STRING ARE HERE, AND THEY CARRY DIFFERENT CLASSIFICATIONS.
 *
 *   Interface mechanics — the media fallback label, the play button — are written here because the
 *   specifications do not supply them and no one else will. They assert nothing about the
 *   business, so `EDITORIAL_COPY` and `NOT_REQUIRED`. Their GROUPS come from
 *   `global_content_group_allowed`, which is a closed list: the play control is an
 *   `ACTION_LABEL`, and `ERROR` was added by 0055 for the fallback label because none of the
 *   eleven original groups was a home for it and bending one to fit would make it unfindable.
 *
 *   The three empty states are SEED §27, §28 and §29 VERBATIM, including their capitalisation and
 *   their full stops. They are not written here and must not be edited to fit: they are the
 *   specification's own answer to "what does a page say when there is nothing to show", and §28
 *   states the reason in the spec itself — "This is better than generating fake client projects."
 *   They are `BRAND_COPY` because they speak in Rivya's voice about Rivya's work.
 *
 * `/portfolio`'s EMPTY STATE IS D10 IN PLAIN ENGLISH. Rivya's delivered work has not been
 * confirmed, so the portfolio must not imply there is any. §28's copy says exactly that and
 * nothing more, which is why `resolution: 'EMPTY_STATE'` in `content/media-slots.ts` refuses to
 * generate imagery for that page: a picture there would assert a project that may not exist.
 *
 * THE CTA LABELS FROM §27 AND §28 ARE NOT SEEDED HERE. They belong to the section's own
 * `cta_label` column, which an editor sets alongside the destination — a call to action with a
 * label in one table and a URL in another is two places to get one control wrong.
 *
 * PUBLISHED AND ENABLED ON INSERT. The public policy on `global_content` requires both
 * `status = 'PUBLISHED'` and `is_enabled`, and a string that arrived as DRAFT would be invisible
 * to exactly the visitors it exists for. Only the seed may insert non-DRAFT — a null actor is the
 * service role to `enforce_status_transition`, and every session actor is refused.
 */
export const globalContentSeed: SeedModule = {
  name: 'global-content',
  description: 'Site-wide strings the renderers require: media chrome and the three empty states.',
  records: [
    {
      seedKey: 'global:ERROR.media_unavailable.label',
      table: 'global_content',
      fields: {
        group_key: 'ERROR',
        key: 'media_unavailable.label',
        label: 'Media unavailable',
        value: 'Image unavailable',
        description:
          'Shown inside a MediaFrame when no asset resolves. The frame keeps its reserved size — it never collapses — so this label sits in the well where the picture would be.',
        is_enabled: true,
        status: 'PUBLISHED',
        fact_classification: 'EDITORIAL_COPY',
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      seedKey: 'global:ACTION_LABEL.media.play',
      table: 'global_content',
      fields: {
        group_key: 'ACTION_LABEL',
        key: 'media.play',
        label: 'Play',
        value: 'Play',
        description:
          'The accessible name of the play control on a video that does not autoplay — which is every video under reduced motion, on a metered connection, or below 768px.',
        is_enabled: true,
        status: 'PUBLISHED',
        fact_classification: 'EDITORIAL_COPY',
        owner_verification: 'NOT_REQUIRED',
      },
    },
    // --- SEED §27, §28, §29, verbatim -----------------------------------------------------------
    {
      seedKey: 'global:EMPTY_STATE.collection',
      table: 'global_content',
      fields: {
        group_key: 'EMPTY_STATE',
        key: 'collection',
        label: 'Collection empty state',
        value:
          'This collection is being prepared. Explore another category or contact Rivya about a custom piece.',
        description: 'SEED §27, verbatim.',
        is_enabled: true,
        status: 'PUBLISHED',
        fact_classification: 'BRAND_COPY',
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      seedKey: 'global:EMPTY_STATE.portfolio',
      table: 'global_content',
      fields: {
        group_key: 'EMPTY_STATE',
        key: 'portfolio',
        label: 'Portfolio empty state',
        value: 'Verified Rivya projects will appear here as the portfolio develops.',
        description:
          'SEED §28, verbatim. D10: delivered work has not been confirmed, so the portfolio says so rather than showing anything.',
        is_enabled: true,
        status: 'PUBLISHED',
        fact_classification: 'BRAND_COPY',
        owner_verification: 'NOT_REQUIRED',
      },
    },
    {
      seedKey: 'global:EMPTY_STATE.journal',
      table: 'global_content',
      fields: {
        group_key: 'EMPTY_STATE',
        key: 'journal',
        label: 'Journal empty state',
        value: 'New material stories, project notes and guides are being prepared.',
        description: 'SEED §29, verbatim.',
        is_enabled: true,
        status: 'PUBLISHED',
        fact_classification: 'BRAND_COPY',
        owner_verification: 'NOT_REQUIRED',
      },
    },
  ],
}
