import type { BlockType } from '@/lib/cms/block-types'
import { isBlockType } from '@/lib/cms/block-types'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * WHAT GROUND EACH BAND SITS ON, WHEN NOBODY HAS SAID (§2.4a, amendment A46).
 *
 * THE PROBLEM THIS SOLVES. `page_sections.theme` is nullable, `SectionShell` fell back to `DEEP`,
 * and exactly one of the thirty-four renderers ever passed anything else. So every band of every
 * CMS route rendered on the same ocean ground: the homepage was 11,993px of one colour at 1440px,
 * and the REDESIGN §A3 "balanced negative space" the brief asks for was indistinguishable from
 * a page that had failed to load. A long page needs a rhythm to be readable at all, and a rhythm
 * is a property of the SEQUENCE, which is the one thing a section renderer cannot see.
 *
 * THE RULE, AND WHERE IT COMES FROM. The reference alternates two warm grounds — mineral, sand,
 * mineral, sand — and interrupts them with full-bleed obsidian at the three moments that are
 * about material rather than about information: the opening, the material story, and the closing
 * invitation. Read off its homepage markup that is eleven alternating bands and three navy ones.
 * So:
 *
 *   1. A DARK BLOCK TAKES A DARK GROUND, wherever it appears. These are the bands whose subject
 *      is the material itself — they carry full-bleed imagery and almost no text, and a warm
 *      ground under a dark photograph is a frame around it rather than a stage for it.
 *   2. EVERY OTHER BLOCK ALTERNATES MINERAL AND SAND, counting only the bands that alternate.
 *      A dark interruption does not advance the counter, so the warm rhythm continues either side
 *      of it rather than restarting — which is what stops two sand bands meeting across a hero.
 *
 * AN EDITOR ALWAYS WINS. This fills `theme` only where it is null. A section whose theme is set in
 * Studio keeps it, which is the whole point of the column being editable: the rule is a default
 * that makes an unconfigured page read well, not a policy that overrides a decision.
 *
 * IT RETURNS THE COLUMN'S OWN SPELLING, not a `SectionScheme`, so `schemeOf()` in `SectionShell`
 * stays the single parser and an unknown value still falls back rather than throwing. Nothing
 * downstream needed to change to accommodate this — every renderer receives a `PageSection` and
 * hands it on, and this is still a `PageSection`.
 */

/**
 * THE BANDS THAT ARE DARK WHEREVER THEY LAND, and the ground each one takes.
 *
 * `hero` and `final-cta` open and close a page; `material-story`, `signature-media` and
 * `scale-statement` are the material moments; `three-d-resin` renders a WebGL canvas whose own
 * chrome is fixed to an obsidian surface (§14), so a light band around it would be the only place
 * on the site where a scheme and its contents disagree.
 *
 * INK RATHER THAN DEEP FOR THE MATERIAL BANDS. INK is the obsidian ground (`#080a0e`) — the
 * reference's own `--obsidian`, and the value the brief measured on its hero. DEEP is the ocean
 * ground, which is lighter and bluer; it reads as a surface rather than as absence, so it suits a
 * closing invitation that carries copy and a button better than it suits a photograph bled to the
 * edges.
 *
 * ONE MAP, NOT A SET PLUS A MAP. Membership is `blockType in DARK_GROUND`, so the list of dark
 * blocks and the ground each takes cannot drift apart — and, incidentally, keeping these as object
 * KEYS is what stops `scripts/design/check-utilities.mjs` reading `'scale-statement'` as a dead
 * Tailwind utility: `scale` is a real utility prefix, and the gate skips a string literal followed
 * by a colon precisely because an object key is not a class name.
 */
const DARK_GROUND: Partial<Record<BlockType, 'INK' | 'DEEP'>> = {
  hero: 'INK',
  'material-story': 'INK',
  'signature-media': 'INK',
  'scale-statement': 'INK',
  'three-d-resin': 'INK',
  'final-cta': 'DEEP',
}

/**
 * The two warm grounds, alternated in this order.
 *
 * Indexed with an explicit parity test rather than `WARM[i % 2]` because `noUncheckedIndexedAccess`
 * is on: an index expression the compiler cannot prove in-range widens to `| undefined`, and a
 * non-null assertion here would be asserting something the ternary simply states.
 */
const WARM = { even: 'MINERAL', odd: 'SAND' } as const

/**
 * Fill `theme` on every section that has none, in page order.
 *
 * Called once per page by `SectionList`. Pure, and exported for the tests that assert the two
 * properties that matter: an explicit theme survives, and the warm bands alternate across a dark
 * interruption rather than restarting after it.
 */
export function withDefaultTheme(sections: readonly PageSection[]): readonly PageSection[] {
  let warmIndex = 0

  return sections.map((section) => {
    // An editor said so. Nothing below runs.
    if (section.theme !== null && section.theme.trim() !== '') return section

    const blockType = isBlockType(section.block_type) ? section.block_type : null

    const dark = blockType === null ? undefined : DARK_GROUND[blockType]
    if (dark !== undefined) {
      // Deliberately does NOT advance `warmIndex`: the warm rhythm continues either side of a
      // dark band rather than restarting, so two sand bands never meet across a hero.
      return { ...section, theme: dark }
    }

    const theme = warmIndex % 2 === 0 ? WARM.even : WARM.odd
    warmIndex += 1
    return { ...section, theme }
  })
}
