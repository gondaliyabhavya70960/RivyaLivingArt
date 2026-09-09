import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The contact form (SEED §22), and the band that mounts it.
 *
 * THE FIELDS ARE FIXED AND THE ENQUIRY TYPES ARE NOT. §22 names six inputs and an upload, and the
 * database columns behind them — `name`, `phone`, `email`, `city`, `message` — are what
 * `inquiries` actually has. An editor cannot add a seventh, because there would be nowhere to put
 * the answer: a form whose fields are configurable is the CONFIGURATOR, which is Phase 19's, has
 * its own tables, and is where a bespoke brief belongs.
 *
 * WHAT IS EDITABLE IS THE LIST OF ENQUIRY TYPES, because that IS editorial. §22's eight are seeded;
 * a studio that stops offering preservation removes a line rather than files a ticket.
 *
 * THE PAYLOAD STILL CARRIES `fields`, and it is deliberately not read by the renderer. Phase 09
 * seeded the §22 field list into it before this block was built, and a schema that stripped it on
 * the next save would silently discard the specification's own record of what the form asks. It is
 * documentation living where an editor can see it.
 */
const schema = z.object({
  /**
   * SEED §22's eight, in its order. The visitor picks one; the studio files the enquiry by it.
   *
   * AN EMPTY LIST HIDES THE CONTROL RATHER THAN RENDERING AN EMPTY SELECT. A dropdown with nothing
   * in it is a question a visitor cannot answer, and the enquiry does not need the answer to be
   * saved — `enquiry_type` is nullable for exactly this reason.
   */
  enquiry_types: z.array(z.string().min(1)).default([]),
  /**
   * §22's own field list, seeded in Phase 09 and kept rather than read. See the note above: the
   * inputs are fixed by the columns behind them.
   */
  fields: z.array(z.object({ label: z.string(), required: z.boolean() }).loose()).default([]),
})

export type ContactFormPayload = z.infer<typeof schema>

export const contactFormBlock: BlockModule<ContactFormPayload> = {
  type: 'contact-form',
  state: 'BUILT',
  label: 'Contact form',
  description:
    'The general enquiry form. The enquiry is written to the database before any WhatsApp handoff, and a failed save never redirects.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { enquiry_types: [], fields: [] },
  payloadFields: [
    {
      name: 'enquiry_types',
      // `json`, because the payload field kinds are text, textarea, boolean, number, select and
      // json — there is no "one per line" control. A JSON array is honest about what the column
      // holds; a textarea split on newlines would silently accept a line with a comma in it as one
      // entry and produce a type nobody chose.
      kind: 'json',
      label: 'Enquiry types',
      help: 'A JSON array of strings, in the order a visitor sees them. An empty array asks no type at all.',
    },
  ],
  entryArrays: [],
  mediaSlots: [],
  // One variant. A form is a column of inputs; a two-column enquiry form is a form people mis-fill.
  layoutVariants: ['contained'],
  /*
   * NOT RESTRICTED TO `/contact`, unlike the configurator.
   *
   * The configurator belongs to one page because it is a bespoke brief with a form definition
   * behind it. This is the general enquiry form, and the phase document puts it on the closing
   * `final-cta` band of any page as well as on `/contact`. An editor who wants "get in touch" at
   * the foot of the process page should not need a developer.
   */
  allowedPages: null,
}
