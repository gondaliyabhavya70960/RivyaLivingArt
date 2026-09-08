import type { SeedModule, SeedRecord } from './types'

/**
 * Site-wide copy that is not attached to any one page: the brand strings, the announcement bar,
 * the search and error surfaces, the inquiry outcomes and the two WhatsApp templates.
 *
 * EVERY STRING HERE IS THE SPECIFICATION'S, VERBATIM — including its capitalisation, its full
 * stops and its line breaks. Where SEED gives wording, that wording is what ships; where it gives
 * none (a `description` explaining a row to an editor) the text is written here and says so. The
 * distinction matters because a reader needs to know which sentences are Rivya's and which are
 * scaffolding.
 *
 * `EMPTY_STATE.collection`, `.portfolio` and `.journal` are NOT here. Phase 08 seeded them in
 * `global-content.ts`, because the `empty-state` block cannot render without them and the engine
 * shipped before this phase did. `tests/unit/seed-modules.test.ts` asserts `seed_key` uniqueness
 * across every module, so restating one here would fail rather than quietly produce two rows
 * fighting over the same key.
 *
 * STATUS. Global labels seed PUBLISHED — a label nobody can read is not a label, and the phase
 * document exempts "global labels and Studio helper copy" from the DRAFT rule. The two exceptions
 * are the longer brand introduction, which SEED §6 marks `DRAFT_MARKETING_COPY` because it
 * describes fabrication capability nobody has confirmed, and the newsletter copy, which §25 makes
 * optional and Phase 09 seeds disabled because no subscription endpoint exists (A3).
 */

function globalRow(
  group: string,
  key: string,
  value: string,
  options: {
    label?: string
    description?: string
    fact?: string
    verification?: string
    status?: string
    enabled?: boolean
  } = {},
): SeedRecord {
  return {
    seedKey: `global:${group}.${key}`,
    table: 'global_content',
    fields: {
      group_key: group,
      key,
      label: options.label ?? null,
      value,
      description: options.description ?? null,
      is_enabled: options.enabled ?? true,
      // A row asserting an unverified claim cannot be published — the database refuses the
      // combination outright — so the flag decides, and a caller cannot state both and be wrong.
      status:
        options.verification === 'OWNER_VERIFICATION_REQUIRED'
          ? 'DRAFT'
          : (options.status ?? 'PUBLISHED'),
      fact_classification: options.fact ?? 'BRAND_COPY',
      owner_verification: options.verification ?? 'NOT_REQUIRED',
    },
  }
}

export const globalSeed: SeedModule = {
  name: 'global',
  description:
    'Brand strings, announcement bar, search, error surfaces, inquiry copy, WhatsApp templates.',
  records: [
    // --- §6 brand -------------------------------------------------------------------------------
    globalRow('BRAND', 'brand.name', 'Rivya Living Art', {
      label: 'Brand name',
      description:
        'SEED §6. Used in the masthead, the SEO title template and both WhatsApp templates.',
    }),
    globalRow(
      'BRAND',
      'brand.descriptor',
      'Collectible Furniture · Resin Art · Digital Fabrication',
      {
        label: 'Brand descriptor',
        description: 'SEED §6, verbatim including the middle dots.',
      },
    ),
    globalRow(
      'BRAND',
      'brand.statement',
      'Functional art shaped through resin, natural materials and digital fabrication.',
      {
        label: 'Brand statement',
        description:
          'SEED §6. The alternative short descriptor — "Objects shaped by material, movement and craft." — is seeded beside this one so the owner can choose between them in Studio rather than retyping.',
      },
    ),
    globalRow(
      'BRAND',
      'brand.statement.alternative',
      'Objects shaped by material, movement and craft.',
      {
        label: 'Brand statement (alternative)',
        description: 'SEED §6. Seeded disabled: it is the choice, not the default.',
        enabled: false,
      },
    ),
    globalRow(
      'BRAND',
      'brand.introduction',
      'Rivya Living Art explores the meeting point of art, material and function. We create statement furniture, sculptural objects and bespoke resin pieces shaped through a combination of resin work, natural materials, digital design, 3D fabrication and hand-finishing.',
      {
        label: 'Brand introduction',
        description:
          'SEED §6, which marks this DRAFT_MARKETING_COPY explicitly: it enumerates fabrication capabilities — resin work, digital design, 3D fabrication, hand-finishing — that only the owner can confirm Rivya has. DRAFT and OWNER_VERIFICATION_REQUIRED for that reason, so Phase 08 refuses to publish it until they do.',
        status: 'DRAFT',
        verification: 'OWNER_VERIFICATION_REQUIRED',
      },
    ),

    // --- §9 announcement bar --------------------------------------------------------------------
    globalRow(
      'ANNOUNCEMENT',
      'bar.message',
      'Bespoke resin furniture, statement art and custom commissions.',
      {
        label: 'Announcement bar message',
        description:
          'SEED §9. Asserts three offered services, so the owner confirms it before it goes live.',
        verification: 'OWNER_VERIFICATION_REQUIRED',
        status: 'DRAFT',
      },
    ),
    globalRow('ANNOUNCEMENT', 'bar.cta_label', 'Discuss a Project', {
      label: 'Announcement bar button',
      description: 'SEED §9.',
      status: 'DRAFT',
    }),
    globalRow('ANNOUNCEMENT', 'bar.cta_href', '/custom-commissions', {
      label: 'Announcement bar destination',
      description:
        'SEED §9 allows WhatsApp or /custom-commissions. The page is seeded rather than the WhatsApp link because a bar that opens a chat before a visitor has read anything asks for a commitment they have no basis for yet. The owner can switch it.',
      fact: 'EDITORIAL_COPY',
      status: 'DRAFT',
    }),

    // --- §26 search -----------------------------------------------------------------------------
    globalRow('FORM_COPY', 'search.placeholder', 'Search furniture, art, materials and stories', {
      label: 'Search placeholder',
      description: 'SEED §26.',
      fact: 'EDITORIAL_COPY',
    }),
    globalRow('EMPTY_STATE', 'search.heading', 'Nothing matched that search.', {
      label: 'Search — no results heading',
      description: 'SEED §26.',
      fact: 'EDITORIAL_COPY',
    }),
    globalRow('EMPTY_STATE', 'search.body', 'Try another material, product type or collection.', {
      label: 'Search — no results body',
      description: 'SEED §26.',
      fact: 'EDITORIAL_COPY',
    }),

    // --- §45 404 --------------------------------------------------------------------------------
    globalRow('ERROR', 'not_found.eyebrow', '404', {
      label: '404 — eyebrow',
      description: 'SEED §45.',
      fact: 'EDITORIAL_COPY',
    }),
    globalRow('ERROR', 'not_found.heading', "This object isn't here.", {
      label: '404 — heading',
      description: 'SEED §45, verbatim including the contraction.',
      fact: 'EDITORIAL_COPY',
    }),
    globalRow('ERROR', 'not_found.body', 'The page may have moved, but there is more to explore.', {
      label: '404 — body',
      description: 'SEED §45.',
      fact: 'EDITORIAL_COPY',
    }),

    // --- §46 500 --------------------------------------------------------------------------------
    globalRow('ERROR', 'server_error.heading', 'Something interrupted the flow.', {
      label: '500 — heading',
      description: 'SEED §46.',
      fact: 'EDITORIAL_COPY',
    }),
    globalRow(
      'ERROR',
      'server_error.body',
      'The page could not be loaded correctly. Try again or return to the collection.',
      { label: '500 — body', description: 'SEED §46.', fact: 'EDITORIAL_COPY' },
    ),

    // --- §47 media failure ----------------------------------------------------------------------
    // The label itself is `ERROR.media_unavailable.label`, seeded in Phase 08 because MediaFrame
    // required it before this phase existed. §47's other instruction — "do not collapse product
    // layout", "provide neutral material-toned fallback" — is not copy and is implemented in
    // MediaFrame, which reserves its box from the CMS ratio and paints the sunken surface.
    globalRow('ERROR', 'media_unavailable.heading', 'Image temporarily unavailable', {
      label: 'Media failure — heading',
      description:
        'SEED §47. The shorter inline label MediaFrame renders is ERROR.media_unavailable.label, seeded in Phase 08.',
      fact: 'EDITORIAL_COPY',
    }),

    // --- §48 inquiry success --------------------------------------------------------------------
    globalRow('FORM_COPY', 'inquiry_success.heading', 'Your enquiry has been saved.', {
      label: 'Inquiry success — heading',
      description:
        'SEED §48. The wording is a statement of fact the product must earn: the inquiry is persisted BEFORE any WhatsApp redirect, and this sentence is only ever shown after that write succeeded.',
      fact: 'EDITORIAL_COPY',
    }),
    globalRow(
      'FORM_COPY',
      'inquiry_success.body',
      'Continue on WhatsApp to discuss the project with Rivya.',
      { label: 'Inquiry success — body', description: 'SEED §48.', fact: 'EDITORIAL_COPY' },
    ),

    // --- §49 form errors ------------------------------------------------------------------------
    globalRow('FORM_COPY', 'error.generic', 'Please check the highlighted fields and try again.', {
      label: 'Form error — generic',
      description: 'SEED §49.',
      fact: 'EDITORIAL_COPY',
    }),
    globalRow(
      'FORM_COPY',
      'error.upload',
      'This file could not be uploaded. Try another file or continue without it.',
      { label: 'Form error — upload', description: 'SEED §49.', fact: 'EDITORIAL_COPY' },
    ),
    globalRow(
      'FORM_COPY',
      'error.inquiry_save',
      'Your enquiry could not be saved. Please try again before continuing to WhatsApp.',
      {
        label: 'Form error — inquiry could not be saved',
        description:
          'SEED §49. This is the message shown when the persist fails, and the rule it belongs to is absolute: never redirect to WhatsApp if the save failed. The copy exists so the refusal is explainable rather than silent.',
        fact: 'EDITORIAL_COPY',
      },
    ),

    // --- §25 newsletter -------------------------------------------------------------------------
    // Seeded DRAFT and disabled. §25 makes the newsletter optional, amendment A3 records that no
    // email provider has been chosen, and Phase 09 builds no subscription endpoint — so the copy
    // exists for the owner to enable rather than being absent and rewritten later from memory.
    globalRow('NEWSLETTER', 'heading', 'Notes from the studio.', {
      label: 'Newsletter heading',
      description: 'SEED §25. Disabled: there is no subscription endpoint (amendment A3).',
      status: 'DRAFT',
      enabled: false,
    }),
    globalRow(
      'NEWSLETTER',
      'body',
      'New work, material stories and selected journal updates from Rivya Living Art.',
      {
        label: 'Newsletter body',
        description: 'SEED §25. Disabled with the heading above.',
        status: 'DRAFT',
        enabled: false,
      },
    ),
    globalRow('NEWSLETTER', 'cta_label', 'Subscribe', {
      label: 'Newsletter button',
      description: 'SEED §25. Disabled with the heading above.',
      status: 'DRAFT',
      enabled: false,
    }),

    // --- §36, §37 WhatsApp templates ------------------------------------------------------------
    //
    // THE TOKEN NAMES ARE PART OF THE CONTRACT, not decoration. Phase 20 substitutes them, and a
    // renamed token is a message that ships to a customer with `{{customer_name}}` in it. Seeded
    // verbatim, including the blank lines, which are what make the message readable in a chat.
    globalRow(
      'WHATSAPP_TEMPLATE',
      'inquiry',
      [
        'Hello Rivya Living Art,',
        '',
        'I would like to enquire about:',
        '',
        'Product / Project: {{product_or_project}}',
        'Name: {{customer_name}}',
        'Phone: {{phone}}',
        'City: {{city}}',
        '',
        'Requirements:',
        '{{customization_summary}}',
        '',
        'Notes:',
        '{{notes}}',
        '',
        'Reference:',
        '{{reference_urls}}',
        '',
        'Inquiry ID:',
        '{{inquiry_id}}',
      ].join('\n'),
      {
        label: 'WhatsApp — product or project enquiry',
        description:
          'SEED §36, verbatim including the token names, which Phase 20 substitutes. The system shortens gracefully if the message runs long and never exposes an internal field.',
        fact: 'EDITORIAL_COPY',
      },
    ),
    globalRow(
      'WHATSAPP_TEMPLATE',
      'commission',
      [
        'Hello Rivya Living Art,',
        '',
        'I would like to discuss a custom project.',
        '',
        'Project Type:',
        '{{project_type}}',
        '',
        'Approximate Size:',
        '{{dimensions}}',
        '',
        'City:',
        '{{city}}',
        '',
        'Material / Colour Direction:',
        '{{material_direction}}',
        '',
        'Notes:',
        '{{notes}}',
        '',
        'Reference Images:',
        '{{reference_urls}}',
        '',
        'Inquiry ID:',
        '{{inquiry_id}}',
      ].join('\n'),
      {
        label: 'WhatsApp — custom commission',
        description: 'SEED §37, verbatim including the token names.',
        fact: 'EDITORIAL_COPY',
      },
    ),
  ],
}
