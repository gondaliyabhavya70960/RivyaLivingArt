import { section } from './section'
import type { SeedModule } from './types'

/**
 * `/portfolio`, SEED §17 — a landing hero and the §28 empty state. Zero projects, permanently
 * until real ones are confirmed.
 *
 * §17 STATES THE RULE IN CAPITALS: "DO NOT create fictional customer projects to fill Portfolio."
 * D10 says the same thing from the other side — delivered projects and named customers are the
 * first two things it forbids fabricating. So this page is two sections and nothing else, and the
 * second one explains the absence rather than papering over it.
 *
 * THE EMPTY STATE IS A BLOCK, NOT A HARD-CODED FALLBACK. `empty-state` reads its message from
 * `global_content` under the key in its payload — `EMPTY_STATE.portfolio`, seeded in Phase 08 with
 * §28's wording verbatim. That indirection is what lets the owner reword it once, for this page
 * and `/journal` and `/collection` alike, and it is why the block renders NOTHING when the row is
 * missing rather than inventing a sentence.
 *
 * §17 also gives a two-line fallback of its own ("Portfolio archive is being prepared. / Explore
 * the collection or discuss a custom project with us."). That is a different wording from §28's,
 * for the same surface. §28's is the one seeded, because it is the section the specification
 * devotes to this state and because it is the one already in the database from Phase 08; §17's
 * lines are carried here as the CTA copy, which is the part §28 does not supply.
 *
 * `content/media-slots.ts` marks `/portfolio` `resolution: 'EMPTY_STATE'` for the same reason:
 * generating imagery for a portfolio would fabricate delivered work in pictures instead of words.
 */

const PAGE = 'page:portfolio'

export const portfolioSeed: SeedModule = {
  name: 'portfolio',
  description: 'The /portfolio landing hero (§17) and its empty state (§28). No projects.',
  records: [
    section({
      page: PAGE,
      key: 'portfolio.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'SELECTED WORKS',
      heading: 'Ideas made material.',
      body: 'A growing archive of finished pieces, prototypes, commissions and material studies.',
      fact: 'BRAND_COPY',
      layoutVariant: 'contained',
      payload: { is_video: false, autoplay: false, scrim: 35 },
    }),

    /**
     * The strip of published projects — Phase 17.
     *
     * IT DRAWS NOTHING TODAY AND SAYS NOTHING ABOUT IT. `show_empty_state` is false because the
     * block below already carries §28's sentence; a strip that also fell back would print it twice.
     * With zero published projects this section is therefore invisible, and the page reads exactly
     * as it did before Phase 17 — which is the correct behaviour for a portfolio with no projects.
     *
     * ITS KEY AND ITS POSITION DISAGREE ON PURPOSE. The keys on this page embed the order they were
     * written in — `portfolio.01.hero`, `portfolio.02.empty-state` — and a seed key is an IDENTITY
     * that must never change once shipped: renaming one orphans the existing row and inserts a
     * duplicate beside it. So this band takes the next free number, `03`, and sorts at position 2.
     * The empty state keeps the key it shipped with and moves to position 3.
     */
    section({
      page: PAGE,
      key: 'portfolio.03.projects',
      blockType: 'portfolio-strip',
      position: 2,
      fact: 'BRAND_COPY',
      payload: { limit: 6, show_empty_state: false },
    }),

    section({
      page: PAGE,
      key: 'portfolio.02.empty-state',
      blockType: 'empty-state',
      position: 3,
      // §17's own two lines, used where §28 supplies nothing: the calls to action.
      ctaLabel: 'View the Collection',
      ctaUrl: '/collection',
      ctaSecondaryLabel: 'Start a Custom Project',
      ctaSecondaryUrl: '/custom-commissions',
      fact: 'BRAND_COPY',
      payload: { content_key: 'portfolio', show_cta: true },
    }),
  ],
}
