import { section } from './section'
import type { SeedModule, SeedRecord } from './types'

/**
 * The ten FAQ entries, SEED §23.
 *
 * ALL TEN ARE `OWNER_VERIFICATION_REQUIRED`, and the phase document's policy table says why in one
 * line: "they touch process, timelines, delivery and customization capability". That is true even
 * of the ones that sound like policy rather than capability — FAQ 05 says Rivya does not process
 * online payments, which is a statement about how the business operates and is only safe to
 * publish because the owner has confirmed it is still true.
 *
 * §23 marks two of them itself (01 and 07). The other eight are flagged on the policy table's
 * reading rather than the specification's, which is the stricter of the two — and for a page whose
 * entire job is answering "can you do X", stricter is right. An unflagged FAQ answer is a promise
 * the site makes on Rivya's behalf.
 *
 * THREE ANSWERS RESTATE FIXED BUSINESS RULES, and they are worth reading against D1:
 *
 *   04 describes the order path — enquiry recorded, then WhatsApp. That is the rule, not a
 *      simplification: the inquiry is persisted BEFORE any redirect, and never redirects if the
 *      save failed.
 *   05 says there is no online payment. Not a limitation to be removed later: no checkout and no
 *      payment gateway are fixed decisions.
 *   06 says there are no customer accounts. Same.
 *
 * They are seeded exactly as §23 words them because those three sentences are how a visitor finds
 * out, and rewording them is how the site drifts away from what it actually does.
 */

const FAQS: readonly { question: string; answer: string }[] = [
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
    'The ten FAQ entries from SEED §23, all flagged for owner verification, and the band that draws them.',
  records: [...FAQS.map(faqRecord), faqListSection],
}
