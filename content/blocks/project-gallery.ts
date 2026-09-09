import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The photographs of a delivered project. FEAT §8's gallery, on a project's story page.
 *
 * THE BLOCK HOLDS NO MEDIA IDS, and that is the same decision `collection-products` records one
 * phase back. The pictures live in `portfolio_project_media`, which already carries the caption, the
 * alt override and the sort order an editor arranges in the Gallery panel. Putting a second copy in
 * the payload would fork the answer in two, and the copy in the payload would be the one nobody
 * updates. The phase document describes this block as "an ordered media list with per-item caption
 * and alt override" — that list exists, as a table, with a Studio panel and a foreign key; what the
 * block contributes is which slice of it to draw.
 *
 * `roles` IS THE QUESTION IT ASKS. A project's media is tagged `hero`, `gallery`, `detail`,
 * `process`, `video` or `model`, so one page can carry a band of finished photographs and a
 * separate band of process shots without either needing a different block. Default `['gallery']`.
 *
 * IT RENDERS NOTHING WITH NOTHING TO SHOW — not a skeleton, not a placeholder frame. Today that is
 * every project, because there are none; when there is one, a band whose role has no pictures is a
 * band the editor has not filled in yet, and an empty frame would look like a broken image.
 *
 * A CONCEPT RENDER CAN NEVER APPEAR HERE, and the guarantee is in the database rather than in this
 * file: `reject_concept_project_media` refuses the join row outright (0150). That is what lets the
 * seeded caption say "photographs of the finished project" without the sentence being a hope.
 */
const schema = z.object({
  /**
   * Which media roles this band draws, in the order the join table gives them.
   *
   * A LIST RATHER THAN ONE VALUE, so a band can show `gallery` and `detail` together — which is how
   * a finished project usually reads — without needing two bands and two headings.
   */
  roles: z.array(z.enum(['hero', 'gallery', 'detail', 'process', 'video', 'model'])).min(1),
  /** A ceiling, never a promise: a project with three photographs shows three. */
  limit: z.number().int().min(1).max(48),
})

export type ProjectGalleryPayload = z.infer<typeof schema>

export const projectGalleryBlock: BlockModule<ProjectGalleryPayload> = {
  type: 'project-gallery',
  state: 'BUILT',
  label: 'Project gallery',
  description: 'The photographs of this project, in the order the gallery panel arranges them.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { roles: ['gallery'], limit: 24 },
  payloadFields: [
    {
      name: 'roles',
      kind: 'json',
      label: 'Which pictures',
      help: 'A list of roles: "hero", "gallery", "detail", "process", "video" or "model". Defaults to ["gallery"].',
    },
    { name: 'limit', kind: 'number', label: 'How many to show', min: 1, max: 48 },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: ['grid', 'stacked'],
  /**
   * A PROJECT PAGE ONLY. Every other block in the catalogue is `allowedPages: null`, and this one is
   * not: it reads `portfolio_project_media` for the project whose page it sits on, so on any other
   * page it has no project and would render nothing at all. Studio filters the picker by this, which
   * is where that mistake would otherwise be made — and a band that silently renders nothing is the
   * hardest kind of empty to diagnose.
   */
  allowedPages: ['/portfolio/[slug]'],
}
