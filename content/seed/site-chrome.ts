import type { SeedModule, SeedRecord } from './types'

/**
 * The strings the public shell renders that no page owns: the skip link, the two menu controls,
 * the announcement bar's dismiss button, the search control, and the accessible names of the
 * landmarks a page carries.
 *
 * WHY THESE ARE IN THE DATABASE AT ALL. "Open menu" is not marketing copy, and the temptation to
 * type it into JSX is exactly what D2 forbids and what `scripts/cms/check-section-copy.ts` fails
 * the build over. The reason is not consistency for its own sake: these are the strings a
 * screen-reader user hears instead of seeing an icon, and the owner must be able to correct them —
 * or translate them, when that day comes — without a deploy. A literal in a component is a string
 * only a developer can change.
 *
 * THEY ARE PHASE 10's, NOT PHASE 09's, AND THAT IS DELIBERATE. Phase 09 seeded the content of the
 * website. Nothing in it needed the name of a landmark, because no landmark existed: there was no
 * header, no footer and no route. Back-filling them into `global.ts` would put strings there whose
 * reason for existing is in a different phase, and the next person reading that module would have
 * no way to tell which sentences came from the SEED specification and which from a component.
 *
 * NONE OF THEM ASSERTS A BUSINESS FACT. They name controls and regions, so every row is
 * `EDITORIAL_COPY` / `NOT_REQUIRED` and seeds `PUBLISHED` — a skip link nobody can read is not a
 * skip link, and the whole shell would be unusable behind an owner-verification gate.
 *
 * THE WORDING IS NOT FROM THE SEED SPECIFICATION, because it gives none for chrome controls. It is
 * written here, in plain British-leaning English, and this comment is the record that it was
 * written rather than quoted — the distinction `global.ts` draws for the same reason.
 */

function chromeRow(
  group: 'ACTION_LABEL' | 'UI_LABEL' | 'WHATSAPP_TEMPLATE' | 'CTA',
  key: string,
  value: string,
  label: string,
  description: string,
): SeedRecord {
  return {
    seedKey: `chrome:${group.toLowerCase()}.${key}`,
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

export const siteChromeSeed: SeedModule = {
  name: 'site-chrome',
  description:
    'Phase 10 shell strings: skip link, menu and dismiss controls, search, and landmark names.',
  records: [
    // --- controls (ACTION_LABEL) ----------------------------------------------------------------
    chromeRow(
      'ACTION_LABEL',
      'skip_to_content',
      'Skip to content',
      'Skip link',
      'The first focusable control on every page. A keyboard user presses Tab once and this appears, letting them jump past the header to the page itself.',
    ),
    chromeRow(
      'ACTION_LABEL',
      'open_menu',
      'Open menu',
      'Mobile menu button',
      'The accessible name of the button that opens the menu on small screens. It shows an icon, so this text is what a screen reader announces.',
    ),
    chromeRow(
      'ACTION_LABEL',
      'close_menu',
      'Close menu',
      'Mobile menu close button',
      'The accessible name of the control that closes the mobile menu.',
    ),
    chromeRow(
      'ACTION_LABEL',
      'dismiss_announcement',
      'Dismiss announcement',
      'Announcement dismiss button',
      'The accessible name of the button that hides the announcement bar. The bar stays hidden in that browser until the announcement text changes.',
    ),
    chromeRow(
      'ACTION_LABEL',
      'search.submit',
      'Search',
      'Search button',
      'The submit button on the search form.',
    ),

    // --- landmarks and regions (UI_LABEL) -------------------------------------------------------
    //
    // A page carries four navigation landmarks. Unnamed, a screen reader announces four regions
    // all called "navigation" and a user cannot tell which is which; these are the names it reads
    // instead. They are never shown on screen.
    chromeRow(
      'UI_LABEL',
      'nav.primary',
      'Primary',
      'Header navigation name',
      'Never shown on screen. A screen reader announces the header menu by this name, so it can be told apart from the footer and category menus.',
    ),
    chromeRow(
      'UI_LABEL',
      'nav.categories',
      'Collection categories',
      'Category menu name',
      'Never shown on screen. Names the panel that opens under Collection in the header.',
    ),
    chromeRow(
      'UI_LABEL',
      'nav.footer',
      'Footer',
      'Footer navigation name',
      'Never shown on screen. Names the footer links region.',
    ),
    chromeRow(
      'UI_LABEL',
      'nav.mobile',
      'Menu',
      'Mobile menu name',
      'Never shown on screen. Names the menu panel that slides in on small screens.',
    ),
    chromeRow(
      'UI_LABEL',
      'search.heading',
      'Search',
      'Search page heading',
      'The visible heading of /search. It names the page: the results heading below it changes with what was searched for, so it cannot be the page heading itself.',
    ),
    chromeRow(
      'UI_LABEL',
      'search.label',
      'Search the site',
      'Search field label',
      'Never shown on screen — the field shows its placeholder instead. This is what a screen reader announces when focus reaches the search box.',
    ),
    chromeRow(
      'UI_LABEL',
      'announcement.region',
      'Announcement',
      'Announcement bar region name',
      'Never shown on screen. Names the strip at the top of the page.',
    ),

    chromeRow(
      'UI_LABEL',
      'error.reference',
      'Reference',
      'Error reference label',
      'Precedes the error code on the 500 page. The code identifies the failure in the server log; it is not a support ticket number and means nothing to a visitor on its own, which is why it is labelled rather than shown bare.',
    ),

    // --- the two error surfaces' controls (§45, §46) ---------------------------------------------
    //
    // VERBATIM FROM THE SPECIFICATION, unlike everything above it in this module. §45 gives the
    // 404 page two CTAs — "View the Collection" and "Return Home" — and §46 gives the error page
    // "Try Again" with "Return Home" as its secondary. `CTA.view_the_collection` was already
    // seeded by Phase 09; these are the two that had no home because no phase had built the
    // surfaces that use them.
    chromeRow(
      'CTA',
      'return_home',
      'Return Home',
      'Return home',
      'SEED §45 and §46, verbatim. The secondary action on both error surfaces.',
    ),
    chromeRow(
      'ACTION_LABEL',
      'try_again',
      'Try Again',
      'Retry after an error',
      'SEED §46, verbatim. Re-runs the render that failed; it does not reload the page.',
    ),

    // --- the greeting for a chat opened without an enquiry (WHATSAPP_TEMPLATE) -------------------
    //
    // THE THIRD WHATSAPP TEMPLATE, AND THE ONLY ONE WITH NO TOKENS. §36 and §37 are the messages
    // sent AFTER an enquiry has been written to the database, and both carry an inquiry id. This
    // one is what the footer's and the contact page's "continue on WhatsApp" opens: a chat with a
    // greeting and nothing else, because at that moment there is nothing to reference and D1
    // forbids inventing one. It is seeded rather than written in `lib/whatsapp/link.ts` for the
    // same reason as everything else here — the owner can reword their own greeting.
    chromeRow(
      'WHATSAPP_TEMPLATE',
      'direct',
      'Hello Rivya Living Art,',
      'WhatsApp — greeting with no enquiry',
      'The message pre-filled when someone opens a chat from the footer or the contact page, before any enquiry has been sent. Deliberately short: the visitor writes the rest.',
    ),
  ],
}
