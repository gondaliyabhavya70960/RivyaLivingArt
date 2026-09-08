import type { SeedModule, SeedRecord } from './types'

/**
 * Studio chrome: the login copy (SEED §38), the dashboard welcome and quick actions (§39), and the
 * content-editor helper messages (§40).
 *
 * THIS MODULE IS THE OTHER HALF OF `components/studio/strings.ts`. That file has carried the Studio
 * copy as typed constants since Phase 04, for a stated reason: the login page has to render before
 * any session exists and therefore before any editing surface, and `global_content` did not exist
 * until Phase 08. Every entry there declares the `global_content` key it becomes — under the group
 * `STUDIO_HELP` — and this module writes those rows.
 *
 * THE CONSTANTS ARE NOT DELETED IN THIS COMMIT, and that is deliberate rather than unfinished. The
 * phase document's exit criteria say "Studio helper copy is seeded and Phase 05 constants are
 * deleted", which is two changes: seed the rows, then make `t()` read them. Doing both at once
 * would mean the login page depends on a database read in the same commit that first writes the
 * rows — and if the seed has not been run against an environment, Studio renders blank rather than
 * degraded. The swap is `t()` reading a request-scoped map with the constant as its fallback,
 * which is what `strings.ts` already documents as the plan. Seeding first is the safe order.
 *
 * PUBLISHED, not DRAFT. The phase document exempts "global labels and Studio helper copy" from the
 * DRAFT rule, and the reason is practical: helper copy nobody can read is not helping. None of it
 * asserts a business fact — it is instructions to staff — with one exception noted below.
 *
 * §39's QUICK ACTIONS ARE SEEDED AS LABELS, NOT AS WIRED CONTROLS. Four of the eight target
 * surfaces that do not exist yet (Add Portfolio Project, Create Journal Post, Run Product Research,
 * Review Scraped Products). The label is what §39 specifies; the dashboard shows only the ones
 * whose route exists and whose permission the viewer holds, which is the Phase 05 card registry's
 * existing behaviour rather than something this module decides.
 */

const helpRow = (key: string, value: string, label: string, description?: string): SeedRecord => ({
  seedKey: `global:STUDIO_HELP.${key}`,
  table: 'global_content',
  fields: {
    group_key: 'STUDIO_HELP',
    key,
    label,
    value,
    description: description ?? null,
    is_enabled: true,
    status: 'PUBLISHED',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'NOT_REQUIRED',
  },
})

/** §39's eight quick actions, in its order. */
const QUICK_ACTIONS: readonly [string, string][] = [
  ['add_product', 'Add Product'],
  ['edit_homepage', 'Edit Homepage'],
  ['upload_media', 'Upload Media'],
  ['add_portfolio_project', 'Add Portfolio Project'],
  ['create_journal_post', 'Create Journal Post'],
  ['view_enquiries', 'View Enquiries'],
  ['run_product_research', 'Run Product Research'],
  ['review_scraped_products', 'Review Scraped Products'],
]

/**
 * §40's helper messages. The specification gives five "for example", and every one of them is a
 * rule the product enforces elsewhere — which is why they are seeded verbatim rather than
 * paraphrased. An editor reading the Higgsfield note is being told the same thing
 * `cms_publish_section` refuses with RV006, and the two must not say different things.
 */
const EDITOR_HELP: readonly [string, string, string][] = [
  [
    'editor.homepage_hero',
    'Homepage Hero',
    'Keep the primary story focused on large-format furniture, collectible design or 3D + resin work.',
  ],
  [
    'editor.homepage_selected_works',
    'Homepage Selected Works',
    'Choose only the pieces you want to feature publicly. Drag to reorder.',
  ],
  ['editor.about', 'About', 'Keep factual manufacturing claims accurate and owner-verified.'],
  [
    'editor.higgsfield_asset',
    'Higgsfield asset',
    'AI-generated concept media must not be presented as completed real Rivya work.',
  ],
  [
    'editor.scraped_product',
    'Scraped competitor product',
    'Research reference only. Never publish competitor imagery or text as Rivya content.',
  ],
]

export const studioHelpSeed: SeedModule = {
  name: 'studio-help',
  description:
    'Studio login copy (§38), dashboard welcome and 8 quick actions (§39), 5 editor helper messages (§40).',
  records: [
    // --- §38 login ------------------------------------------------------------------------------
    helpRow('login.heading', 'Rivya Studio', 'Studio login — heading', 'SEED §38.'),
    helpRow(
      'login.body',
      'Manage the collection, website, media, enquiries and research workspace.',
      'Studio login — body',
      'SEED §38.',
    ),
    helpRow(
      'login.button',
      'Sign In',
      'Studio login — button',
      'SEED §38, which also fixes what must NOT be here: no public signup call to action. Studio access is granted by invitation, never requested.',
    ),

    // --- §39 dashboard --------------------------------------------------------------------------
    helpRow('dashboard.heading', 'Studio Overview', 'Dashboard — heading', 'SEED §39.'),
    helpRow(
      'dashboard.intro',
      "Manage Rivya's website, products, media, enquiries, merchandising and competitive research from one workspace.",
      'Dashboard — introduction',
      'SEED §39.',
    ),
    ...QUICK_ACTIONS.map(([key, label]) =>
      helpRow(
        `dashboard.action.${key}`,
        label,
        `Quick action — ${label}`,
        'SEED §39. Shown only where the route exists and the viewer holds the permission; role visibility is the Phase 05 card registry, not this row.',
      ),
    ),

    // --- §40 editor helpers ---------------------------------------------------------------------
    ...EDITOR_HELP.map(([key, label, value]) => helpRow(key, value, label, 'SEED §40.')),
  ],
}
