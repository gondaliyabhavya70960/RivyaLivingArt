import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * Questions and answers drawn from the `faqs` table.
 *
 * PAYLOAD FAMILY: A QUERY, like `collection-products` and `journal-strip` — the block holds no copy
 * of its own, it holds the parameters of a read. The rows live in `faqs` because they are edited
 * there, appear in search there, and carry their own `owner_verification` there; copying ten
 * questions into a section payload would make the FAQ page and the FAQ table two different
 * answers to the same question.
 *
 * RESOLVED BEFORE RENDER, THROUGH `lib/cms/references.ts`. `SectionRenderer` is synchronous and
 * pure (see `components/sections/types.ts`), so the rows arrive as `reference.faqs` rather than
 * being fetched here — the same arrangement `project-gallery` uses for its pictures, added in the
 * same place and for the identical reason.
 *
 * `<details>` RATHER THAN THE `Disclosure` PATTERN, and that is a budget decision with an
 * accessibility dividend. RC-206 is a Client Component; `components/sections/registry.ts` imports
 * every renderer, so one static island here is an island on all sixteen CMS routes — the lesson
 * `HeroMotion` and `MaterialSequence` taught in the same phase. A native `<details>` needs no
 * JavaScript at all, is open to find-in-page, keyboard and assistive technology on arrival, and is
 * printed expanded. The only thing it gives up is the animated collapse.
 *
 * STRUCTURED DATA IS NOT THIS BLOCK'S BUSINESS. `/faq` emits `FAQPage` from the VERIFIED rows only
 * (Phase 39), in the route, and this renders every published row. A rich result carries none of the
 * page's caveats, which is why the two have different rules on purpose.
 */
const schema = z.object({
  /**
   * One `faqs.category`, or empty for all of them.
   *
   * A CATEGORY THAT MATCHES NOTHING RENDERS NOTHING, never every row. An editor who mistypes a
   * category should see an empty band and go and fix it, not silently publish the whole table.
   */
  category: z.string(),
})

export type FaqListPayload = z.infer<typeof schema>

export const faqListBlock: BlockModule<FaqListPayload> = {
  type: 'faq-list',
  state: 'BUILT',
  label: 'FAQ list',
  description: 'Questions and answers drawn from the FAQ table.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: { category: '' },
  payloadFields: [
    {
      name: 'category',
      kind: 'text',
      label: 'Category',
      help: 'One FAQ category, or empty for every question. A category that matches nothing renders nothing.',
    },
  ],
  entryArrays: [],
  mediaSlots: [],
  /*
   * `by-category` GROUPS UNDER A SUBHEADING taken from the row's own `category` column — never a
   * label written here, which would be copy in a code file. A row with no category falls into an
   * untitled group at the end rather than being dropped.
   */
  layoutVariants: ['flat', 'by-category'],
  allowedPages: null,
}
