import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The band that mounts the bespoke configurator on `/custom-commissions`.
 *
 * IT CARRIES A FORM SLUG AND NOTHING ELSE. The questions live in
 * `customization_forms`/`_steps`/`_fields`, edited at `/studio/catalog/customization-forms`; a
 * payload that duplicated any of them would fork the answer in two, and the copy in the payload
 * would be the one nobody updates. What the block contributes is WHICH form this page mounts.
 *
 * A SLUG RATHER THAN AN ID, deliberately. `entity_relations` and the media slots address rows by
 * uuid because those rows have no other stable name; a form does — its slug is a public identifier
 * the product rail already emits in `/custom-commissions?product=…`, and a payload naming
 * `furniture-commission` is legible in a revision diff where a uuid is not.
 *
 * IT RENDERS NOTHING WHEN THE FLAG IS OFF, and that is not this file's decision — the renderer asks
 * `isEnabled('commission_configurator')` server-side and returns null. The flag ships OFF: Phase 19
 * builds the form and Phase 20 persists what it collects, so between the two a visitor completing
 * eleven steps would reach a submit button that saves nothing. `/custom-commissions` keeps its
 * Phase 09 copy in the meantime, which is what the phase document's out-of-scope section requires.
 *
 * IT ALSO RENDERS NOTHING WHEN THE NAMED FORM IS NOT PUBLISHED. All three seeded templates arrive
 * DRAFT — `enforce_form_publishable()` refuses PUBLISHED for a form whose steps have not been
 * written yet, and the seed writes the form row before its eleven steps — so publishing the brief is
 * an editor's act after reviewing it. A block pointing at a draft form is a band waiting for that,
 * not an error to show a visitor.
 */
const schema = z.object({
  /**
   * `customization_forms.slug`. Empty means "the default form for this page", which today is the
   * furniture template — the only one of the three carrying no verification flag.
   */
  formSlug: z.string().max(120),
})

export type CommissionConfiguratorPayload = z.infer<typeof schema>

export const commissionConfiguratorBlock: BlockModule<CommissionConfiguratorPayload> = {
  type: 'commission-configurator',
  state: 'BUILT',
  label: 'Commission configurator',
  description:
    'Mounts the multi-step bespoke brief. Renders nothing while the commission_configurator flag is off or the named form is unpublished.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { formSlug: 'furniture-commission' },
  payloadFields: [
    {
      name: 'formSlug',
      kind: 'text',
      label: 'Which form',
      help: 'The slug of a published customization form, e.g. "furniture-commission". Leave blank for the default.',
    },
  ],
  entryArrays: [],
  mediaSlots: [],
  // One variant. A brief is a column of questions read top to bottom; there is no second reading
  // order for it, and offering a "grid" would let an editor lay out a form nobody could follow.
  layoutVariants: ['contained'],
  /*
   * `/custom-commissions` ONLY, matching `project-gallery`'s restriction and for a sharper reason.
   * The block mounts a form bound to a page-level context — the `?product=` parameter that
   * pre-fills the project type is read by the route, not by the block — so dropping it onto the
   * homepage would render a brief with no way to know what it is about. It is also the one block
   * whose visibility depends on a feature flag, and a flag switched on for one page is easier to
   * reason about than one whose effect appears wherever somebody happened to add a band.
   */
  allowedPages: ['/custom-commissions'],
}
