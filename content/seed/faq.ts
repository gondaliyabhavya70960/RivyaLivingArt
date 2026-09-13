import { section } from './section'
import type { SeedModule, SeedRecord } from './types'

/**
 * The FAQ entries — SEED §23's original ten, and forty-five more from the owner's Studio content
 * pack (2026-09-13).
 *
 * ALL FIFTY-FIVE ARE `OWNER_VERIFICATION_REQUIRED` AND ALL ARE `DRAFT`, which is two gates rather
 * than one. The phase document's policy table gives the reason for the first in a line: FAQ answers
 * "touch process, timelines, delivery and customization capability". That is true even of the ones
 * that sound like policy rather than capability — 05 says Rivya does not process online payments,
 * which is a statement about how the business operates and is only safe to publish because the
 * owner has confirmed it is still true. `faqs_verified_before_publish` (migration 0050) enforces
 * it in the database, so an unverified answer cannot reach the public site even by accident.
 *
 * THE FIRST TEN ARE UNCHANGED, DELIBERATELY, AND THE PACK PROPOSED OTHERWISE. The content pack
 * supplies its own wording for 01-10 — tightened, a little shorter, and different in every one but
 * 06. It was not taken. These ten are SEED §23 verbatim, and three of them restate fixed business
 * rules that a paraphrase erodes:
 *
 *   04 describes the order path — enquiry recorded, then WhatsApp. That is the rule, not a
 *      simplification: the inquiry is persisted BEFORE any redirect, and never redirects if the
 *      save failed.
 *   05 says there is no online payment. Not a limitation to be removed later: no checkout and no
 *      payment gateway are fixed decisions.
 *   06 says there are no customer accounts. Same.
 *
 * Rewording those is how the site drifts away from what it actually does, and the owner can edit
 * any of them in Studio — which is the right place for a wording change, because the runner stops
 * owning a row an editor has touched.
 *
 * `caution` NEVER REACHES THE DATABASE. Three of the pack's answers ended with an instruction to
 * whoever verifies them rather than a sentence for a visitor — "Do not publish a blanket insurance
 * claim", and two like it. `faqs` has no notes column, so leaving them in `answer` would have put
 * operator shorthand in the one field a visitor reads. They are split out here as a code-level
 * annotation instead: present for the person doing the verification, absent from the row.
 *
 * WHAT THE PACK DOES NOT DO. It states no lead time in days or weeks, no UV or yellowing warranty,
 * no food-safe claim, no edition size, and no delivered commission — every answer that touches one
 * of those says the answer depends on the project, or declines it outright. That is D10 holding at
 * the point copy is written rather than at review.
 */

const FAQS: readonly { question: string; answer: string; caution?: string }[] = [
  {
    question: 'Do you make custom-size furniture?',
    answer:
      'Custom sizing can be discussed for eligible projects. Share your approximate dimensions, space details and intended use through the commission form or WhatsApp.',
  },
  {
    question: 'Can I choose the resin colour?',
    answer:
      'Colour customization may be available depending on the product or commission. Available options are shown on product pages where applicable, or can be discussed for a custom project.',
  },
  {
    question: 'Can I send reference images?',
    answer:
      'Yes. Reference images can be uploaded with an enquiry to help communicate your preferred form, colour, material direction or space.',
  },
  {
    question: 'How do I place an order?',
    answer:
      'Select a product or start a custom enquiry, enter your requirements and choose Place Order. Your enquiry is recorded and you are then redirected to WhatsApp to continue the conversation with Rivya.',
  },
  {
    question: 'Can I pay directly on the website?',
    answer:
      'No. Rivya does not process online payments through the website. Pricing, payment arrangements and delivery details are finalized directly through WhatsApp.',
  },
  {
    question: 'Do I need an account to place an enquiry?',
    answer:
      'No. There are no customer accounts. You can browse, customize and submit an enquiry without creating an account.',
  },
  {
    question: 'Do you create one-of-one pieces?',
    answer:
      'One-of-one and bespoke directions may be available depending on the project. Contact Rivya with your idea to discuss possibilities.',
  },
  {
    question: 'Can you work from my room or interior references?',
    answer:
      'Yes. Space photographs, measurements and reference imagery can help establish the visual and dimensional direction for a custom enquiry.',
  },
  {
    question: 'Where is pricing shown?',
    answer:
      'Products may display a fixed price, a starting price or a request-for-quote state depending on the nature of the piece. Bespoke projects are discussed individually.',
  },
  {
    question: 'How do custom commissions begin?',
    answer:
      'Start by sharing the type of object, approximate dimensions, intended use, location and any visual references you already have. Rivya will continue the discussion through WhatsApp.',
  },
  {
    question: 'Where is the studio based?',
    answer:
      'Rivya works from India. Exact visit arrangements are confirmed directly; do not publish a walk-in address until the owner sets one in Site Settings.',
  },
  {
    question: 'Do you ship outside India?',
    answer:
      'Export can be discussed per project. Crating, routes and Incoterms are agreed on WhatsApp — not as a site-wide promise.',
  },
  {
    question: 'What is a typical lead time?',
    answer:
      'Lead time depends on scale, cure, finish and site access. Rivya will give a range only after the brief is clear.',
  },
  {
    question: 'Can I visit to see samples?',
    answer:
      'Material samples and studio visits can be arranged when available. Ask on WhatsApp rather than assuming a public showroom.',
  },
  {
    question: 'Do you work with interior designers?',
    answer:
      'Yes. Designers can share drawings, finishes and room photographs. The enquiry is still recorded against the project, not a designer login.',
  },
  {
    question: 'Do you work with architects?',
    answer:
      'Yes. Built-in and large-format pieces need a site measure and a clear owner of the drawing set.',
  },
  {
    question: 'Can you match an existing stone or fabric?',
    answer: 'Bring or send physical samples. Screens are not a colour contract.',
  },
  {
    question: 'Do you make outdoor furniture?',
    answer:
      'Most work is conceived for interiors. Covered outdoor use is a separate conversation about UV and climate.',
  },
  {
    question: 'Is the surface heat resistant?',
    answer:
      'Dining use is expected with ordinary care. Hot cookware should not sit directly on resin. Confirm any hospitality specification in writing.',
  },
  {
    question: 'Is the surface food safe?',
    answer: 'Do not assume food contact. Serving pieces need a separate review before any claim.',
  },
  {
    question: 'How do I clean a resin table?',
    answer:
      'Dust with a soft cloth. Avoid abrasives and harsh solvents. The owner should confirm any named cleaner before it is published.',
  },
  {
    question: 'Will the resin yellow?',
    answer:
      'UV behaviour depends on resin system, tint and light. Ask for the current system rather than reading a generic promise on the site.',
  },
  {
    question: 'Can you embed flowers or personal objects?',
    answer:
      'Preservation work is possible as a brief. Moisture, size and clarity limits are discussed per object. No permanence claim.',
  },
  {
    question: 'Can you reproduce a river-table image I saw online?',
    answer:
      "References help direction. Rivya does not copy another maker's piece. The pour and the timber will not match a photograph.",
  },
  {
    question: 'Do you use live-edge slabs?',
    answer:
      'Live edge and cut edge are both possible. Availability of a particular slab is never guaranteed from a website picture.',
  },
  {
    question: 'Which woods do you work with?',
    answer:
      'Hardwoods such as walnut, oak, teak and local species can be discussed. Species is confirmed per project against what can actually be sourced.',
  },
  {
    question: 'Can the base be customized?',
    answer:
      'Yes. Metal and timber bases are part of the brief. Structure must suit the span and the floor.',
  },
  {
    question: 'Do you make chairs and sofas?',
    answer:
      'Seating is treated as sculptural furniture. Comfort and structure are proven before a seat is offered as a product.',
  },
  {
    question: 'Do you make beds or wardrobes?',
    answer:
      'Those typologies are not the centre of the collection. Ask if a related plane or panel is what you need.',
  },
  {
    question: 'Can you make a reception desk?',
    answer: 'Large-format reception pieces can be discussed from drawings and site photos.',
  },
  {
    question: 'Can you make a conference table?',
    answer:
      'Yes, at dining-to-boardroom scale. Cable routes and seating count belong in the first note.',
  },
  {
    question: 'What is large-format at Rivya?',
    answer:
      'Pieces whose scale is part of the design — dining, conference, consoles and wall planes that organise a room.',
  },
  {
    question: 'What is 3D resin?',
    answer:
      'A direction that combines digital form with resin. Any specific process is confirmed by the owner before it is offered.',
  },
  {
    question: 'Do you 3D-print entire tables?',
    answer: 'Printed parts may support a piece. A printed dining slab is not a default offering.',
  },
  {
    question: 'Can I buy from stock?',
    answer:
      'Most work is made to order. Anything listed as available is marked as such on the product page.',
  },
  {
    question: 'Can I reserve a slab?',
    answer:
      'Slab holds, if offered, are agreed directly and expire. The site does not run a reservation cart.',
  },
  {
    question: 'Do you offer installation?',
    answer:
      'Installation and placement can be arranged by project and city. It is not an automatic line item.',
  },
  {
    question: 'Who handles damage in transit?',
    answer: 'Crating and carrier terms are written into the project confirmation.',
    caution: 'Do not publish a blanket insurance claim.',
  },
  {
    question: 'Can I see work in progress?',
    answer:
      'Progress photographs can be shared for a commission when agreed. They are not a public production feed.',
  },
  {
    question: 'Do you take institutional or hotel projects?',
    answer:
      'Hospitality and workplace projects are possible when durability and programme are clear from the start.',
  },
  {
    question: 'Can two rooms share a material language?',
    answer: 'Yes. A house or office can be briefed as a set: table, console, panel.',
  },
  {
    question: 'Do you sell décor and gifts?',
    answer: 'Smaller objects exist as a secondary line. They are not the centre of the brand.',
  },
  {
    question: 'Can a gift be personalised?',
    answer:
      'Monograms, dates and small inclusions can be discussed. Keep the object honest about size.',
  },
  {
    question: 'What if I only have a Pinterest board?',
    answer: 'Send it. Also send the room. A board without dimensions is only a mood.',
  },
  {
    question: 'Do you sign pieces?',
    answer: 'Signing and certificates, if offered, are decided per work.',
    caution: 'Do not publish a signature policy until the owner writes one.',
  },
  {
    question: 'Are pieces numbered editions?',
    answer:
      'Only if the owner declares an edition. Unique and made-to-order are the default language.',
  },
  {
    question: 'Can I commission a wall mural in resin?',
    answer: 'Large wall planes are part of statement art. Access, hanging and weight come first.',
  },
  {
    question: 'Do you restore damaged resin furniture?',
    answer: 'Repair is a different service from making. Ask with photographs; it may be declined.',
  },
  {
    question: 'What information do you store from an enquiry?',
    answer:
      'Name, contact, project notes and any files you upload — enough to continue on WhatsApp. There is no customer account.',
  },
  {
    question: 'How fast do you reply?',
    answer: 'Rivya aims to continue the conversation promptly on WhatsApp.',
    caution: 'Do not publish a guaranteed response time unless the owner sets one.',
  },
  {
    question: 'Can I change the brief after work starts?',
    answer:
      'Changes are possible until materials are committed. After pour and print, changes become a new conversation.',
  },
  {
    question: 'Do you offer samples of colour?',
    answer: 'Small colour and finish samples can be discussed. A sample is not the final pour.',
  },
  {
    question: 'Is teak or sheesham available?',
    answer:
      'Indian hardwoods can be part of a brief when the project wants them. Confirm species against current supply.',
  },
  {
    question: 'Can you work in Ahmedabad or Surat?',
    answer:
      'Site work in Gujarat and across India is discussed per project. Travel is not assumed.',
  },
  {
    question: 'Why is some copy still in draft on the site?',
    answer:
      'Rivya publishes only what the owner has verified. Empty or quiet pages are preferred to invented work.',
  },
]

const faqRecord = (f: (typeof FAQS)[number], i: number): SeedRecord => ({
  // `faq.01` … `faq.10` — the specification's own numbering, which is also the display order.
  seedKey: `faq:${String(i + 1).padStart(2, '0')}`,
  table: 'faqs',
  fields: {
    question: f.question,
    answer: f.answer,
    category: null,
    position: (i + 1) * 10,
    status: 'DRAFT',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'OWNER_VERIFICATION_REQUIRED',
  },
})

/**
 * THE BAND THAT DRAWS THEM — Phase 45.
 *
 * Until this existed, `/faq` had a page row, ten `faqs` rows and NO SECTIONS AT ALL, so the route
 * answered 404 and the ten answers had nowhere to appear. That is the same shape of gap
 * `cropsForAssets` had — both ends built, the middle missing — and it was invisible because every
 * CMS route 404s until an editor publishes, so an empty page and an unpublished one look identical.
 *
 * IT CARRIES NO COPY OF ITS OWN, and that is deliberate rather than an omission. A heading here
 * would be a sentence this repository wrote for the top of a page, which is what D2 forbids.
 * `content/seed/pages.ts` says the same thing from the other side: "`title` IS THE ROUTE'S NAME,
 * NOT A HEADLINE … the page's actual heading is a `hero` or `statement` section an editor writes."
 * So the title is not borrowed for it either. `category: ''` means every question, in
 * `faqs.position` order.
 *
 * **THE MISSING `h1`, AND THE TWO THINGS IT ACTUALLY TOOK.** This note used to say `/faq` had no
 * heading seeded, that "`SectionList` gives the FIRST section level 1, so typing a heading on this
 * band is enough", and that the sentence was somebody else's to write. The first clause was true;
 * the second was WRONG and cost a red CI run on `main` to disprove. `SectionList` assigns no
 * heading levels at all — `SectionCopy` defaults to `level = 2` and `FaqListSection` passed none,
 * so a heading typed on this band rendered an `h2` and the page still had no `h1`. Measured: five
 * h2s, zero h1s.
 *
 * Both halves are fixed now. `FaqListSection` passes `level={isFirst ? 1 : 2}`, and the heading
 * below is seeded. It is the page's OWN NAME — `pages.ts` already titles this route "Frequently
 * Asked Questions" — so it asserts nothing about the business that the route's existence did not
 * already assert, which is why it can be written here when the ten answers below cannot.
 *
 * `tests/e2e/a11y/headings.spec.ts` skips a route that is not published, which is why this went
 * unseen: `/faq` 404'd until Phase 45 seeded this band, and the spec ran against it for the first
 * time the moment it served 200.
 *
 * DRAFT, like every seeded section, so `/faq` stays 404 until somebody publishes it — and the ten
 * answers stay `OWNER_VERIFICATION_REQUIRED` until the owner clears them, which is a second gate
 * and the one that matters.
 */
const faqListSection = section({
  page: 'page:faq',
  key: 'faq.01.list',
  blockType: 'faq-list',
  position: 1,
  fact: 'EDITORIAL_COPY',
  // The page's own name, so `/faq` has an `h1`. Sentence case with a full stop, like the other
  // fifty seeded headings. NOT `verify: true`: naming a page after what it contains is not a
  // business claim, and flagging it would keep the route at 404 for a label.
  heading: 'Frequently asked questions.',
  payload: { category: '' },
})

export const faqSeed: SeedModule = {
  name: 'faq',
  description:
    "Fifty-five FAQ entries — SEED §23's original ten verbatim plus the owner's Studio pack — every one DRAFT and flagged for owner verification, and the band that draws them.",
  records: [...FAQS.map(faqRecord), faqListSection],
}
