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

/**
 * What the owner is being asked to confirm, per flagged section. Phase 12.
 *
 * KEYED BY THE SECTION'S OWN KEY — `verification.about.03.scale` for the section seeded
 * `section:about.03.scale`. The `section:` prefix is added back at the lookup rather than stored,
 * because a seed key carries exactly one colon and `tests/unit/seed-modules.test.ts` asserts it.
 * The note travels with the section rather than with a page
 * or a block type: `/process` is seven sections of one block type asserting seven different
 * things, and one note for `process-steps` would be no note at all.
 *
 * ONLY WHERE THE SPECIFICATION HAS WORDING OF ITS OWN, or where the claim is not obvious from the
 * heading. SEED §16 marks exactly one of the seven process steps — step 04 — and its sentence is
 * reproduced verbatim below. The other six carry notes this project wrote when Phase 09 extended
 * the flag to all seven under D10, and each says what the step would be asserting if published;
 * the attribution matters, so the `description` on each row records which is which.
 *
 * A SECTION WITH NO ROW GETS NO NOTE. `VerificationBanner` quotes the section's own heading in
 * every case, which is the claim itself; a generic sentence added underneath would be boilerplate
 * beside a specific claim, and boilerplate is what an editor learns to skip.
 */
/**
 * Phase 35. The acknowledgement the bridge's submit button depends on, and the two screens' helper
 * copy. THE ACKNOWLEDGEMENT IS THE ONE THAT MATTERS: the phase document requires its label to be
 * seeded copy stating that no competitor data is being imported, so the sentence a person ticks
 * is owned by the CMS and not by a component.
 */
const PHASE_35_HELP: readonly [string, string, string][] = [
  [
    'research_bridge_acknowledgement',
    'Research bridge — acknowledgement',
    'I understand that no competitor data is being imported. The draft holds only the slug and category I chose; every other field stays empty for a person to write.',
  ],
  [
    'research_sl_intro',
    'Research shortlist — introduction',
    'Rows a merchandiser set aside, with the reason and the score as it stood. A row leaving the shortlist closes its entry; nothing here is deleted.',
  ],
  [
    'research_cf_intro',
    'Research confirmed list — introduction',
    'Research decisions, not products. Each row is a competitor reference somebody confirmed with a note. A Rivya product exists only where a person started one by hand, and it holds nothing copied from here.',
  ],
]

const VERIFICATION_NOTES: readonly [string, string, string][] = [
  [
    'about.03.scale',
    'Confirm that large-format functional art is the studio’s primary direction today, and that smaller décor, preservation and personalised pieces are genuinely offered.',
    'SEED §11 flags this section; the wording of the note is this project’s.',
  ],
  [
    'about.04.bespoke',
    'Confirm that bespoke work can respond to a particular interior, requirement or idea — that proportion, materials, colour and detail are genuinely variable per project.',
    'SEED §11 flags this section; the wording of the note is this project’s.',
  ],
  [
    'process.02.brief',
    'Confirm that Rivya defines purpose, dimensions, context and visual direction with a client before work begins.',
    'SEED §16 does not flag this step; Phase 09 extended the flag to all seven under D10.',
  ],
  [
    'process.03.material-direction',
    'Confirm that material, colour and structural direction are explored and agreed before fabrication.',
    'SEED §16 does not flag this step; Phase 09 extended the flag to all seven under D10.',
  ],
  [
    'process.04.form-development',
    'Confirm that form and proportion are developed as a distinct stage of the work.',
    'SEED §16 does not flag this step; Phase 09 extended the flag to all seven under D10.',
  ],
  [
    'process.05.fabrication',
    'Avoid specific production claims until verified.',
    'SEED §16, verbatim — the only step the specification itself flags.',
  ],
  [
    'process.06.resin-work',
    'Confirm that the resin processes described — pouring, colour work and curing — are performed as stated.',
    'SEED §16 does not flag this step; Phase 09 extended the flag to all seven under D10.',
  ],
  [
    'process.07.finishing',
    'Confirm that surfaces, edges and material transitions are finished in-house as described.',
    'SEED §16 does not flag this step; Phase 09 extended the flag to all seven under D10.',
  ],
  [
    'process.08.final-review',
    'Confirm that a completed piece is reviewed against its intended form, finish and project requirements before handover.',
    'SEED §16 does not flag this step; Phase 09 extended the flag to all seven under D10.',
  ],
]

/**
 * Phase 37: the Analytics tab's fixed sentences — the traffic note above all, which is the one
 * statement on the tab that stops a reader mistaking database-derived content health for page
 * views. Seeded so the owner can reword it; the reasons a metric is unavailable are composed in
 * code because they name tables, keys and sources.
 */
const PHASE_37_HELP: readonly [string, string, string][] = [
  [
    'analytics_traffic_note',
    'Analytics — traffic note',
    'Traffic analytics are not connected: no page views, sessions or visitors are measured. Content performance is read from the database.',
  ],
  ['analytics_unavailable_lead', 'Analytics — unavailable lead', 'Not measured, and here is why:'],
  [
    'analytics_work_item',
    'Analytics — work item',
    'What would make it available is named above; it is a work item, not missing data.',
  ],
  [
    'analytics_no_snapshot_body',
    'Analytics — no snapshot yet',
    'The daily job has not run since this deployment. Run npm run analytics:snapshot, or wait for the 03:45 UTC cron; nothing is estimated in the meantime.',
  ],
  [
    'analytics_trend_single',
    'Analytics — single snapshot',
    'One snapshot so far — a trend needs two. Nothing is extrapolated.',
  ],
]

/** Phase 38: the two permanent lines the system pages carry, seeded so the owner can reword them. */
const PHASE_38_HELP: readonly [string, string, string][] = [
  [
    'env_reachability_note',
    'Environment — reachability note',
    'This page reports reachability only. It never displays the value, prefix, length or hash of any variable.',
  ],
  [
    'docs_allowlist_note',
    'Documentation — allowlist note',
    'Ten documents are served from a fixed allowlist and redacted when the index is built. The browser is read-only; the repository is the source.',
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

    // --- Phase 35: the shortlist, the confirmed list and the bridge's acknowledgement ------------
    ...PHASE_35_HELP.map(([key, label, value]) =>
      helpRow(
        key,
        value,
        label,
        'Phase 35, PHASE-31-38 §Phase 35. Seeded, not hard-coded: the bridge dialog renders this row, and the copy states what is NOT imported.',
      ),
    ),

    // --- Phase 37: the Analytics tab's fixed sentences -------------------------------------------
    ...PHASE_37_HELP.map(([key, label, value]) =>
      helpRow(
        key,
        value,
        label,
        'Phase 37, PHASE-31-38 §Phase 37. The traffic note is the sentence that keeps content performance from being read as page views.',
      ),
    ),

    // --- Phase 38: the system pages' permanent lines --------------------------------------------
    ...PHASE_38_HELP.map(([key, label, value]) =>
      helpRow(key, value, label, 'Phase 38, PHASE-31-38 §Phase 38 (FEAT §29, §30).'),
    ),

    // --- Phase 12: per-section verification notes -----------------------------------------------
    ...VERIFICATION_NOTES.map(([sectionKey, value, source]) =>
      helpRow(`verification.${sectionKey}`, value, `Verification note — ${sectionKey}`, source),
    ),
  ],
}
