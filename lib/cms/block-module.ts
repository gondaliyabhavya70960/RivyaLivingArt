import type { z } from 'zod'

import type { AspectRatio } from '@/lib/media/types'

import type { BlockType } from './block-types'

/**
 * What a block declares about itself.
 *
 * ONE FILE PER BLOCK IN `content/blocks/`, and this is its shape. The registry composes them; no
 * renderer, editor or migration reads a block's details from anywhere else.
 *
 * THIS MODULE IMPORTS NO REACT, AND NEITHER DOES `lib/cms/registry.ts`. That is what lets the
 * schedule cron, the seed runner and a Node script ask "what fields does a hero have?" without
 * pulling a component tree into a process that has no DOM. Renderers live in a parallel registry
 * under `components/sections/`, keyed by the same union, and the registry test asserts the two
 * stay in step.
 */

/**
 * Which of the SEED §5 shared COPY fields this block uses.
 *
 * THE CHROME FIELDS ARE NOT IN THIS LIST AND CANNOT BE OPTED OUT OF. `theme`, `layout_variant`,
 * `is_visible`, `position`, the schedule pair, `fact_classification`, `owner_verification` and
 * `field_classifications` are rendered by the shared section editor for EVERY block regardless of
 * what it declares. Letting a block drop them would mean a `divider` with no visibility toggle and
 * no schedule — and exit criterion 2 ("every SEED §5 field is editable in Studio") would be false
 * for it. `sharedFields: []` therefore means "no copy fields", never "no editor".
 */
export const SHARED_COPY_FIELDS = [
  'eyebrow',
  'heading',
  'heading_highlight',
  'body',
  'supporting',
  'cta_label',
  'cta_url',
  'cta_secondary_label',
  'cta_secondary_url',
  'media_desktop_id',
  'media_mobile_id',
  'media_alt_override',
] as const

export type SharedCopyField = (typeof SHARED_COPY_FIELDS)[number]

/**
 * How far along a block is.
 *
 * `BUILT` is a claim the registry test verifies against files on disk. `PLANNED` is honest about
 * a block whose schema exists so a page can hold one, but which has no renderer yet — the public
 * site renders nothing for it rather than crashing, and Studio says so.
 */
export type BlockState = 'BUILT' | 'PLANNED'

/** A media slot a block declares, beyond the shared desktop/mobile pair. */
export type BlockMediaSlot = {
  /** Slot id, local to the block — `'poster'`, `'gallery'`. Combined with a page's registry key. */
  readonly id: string
  readonly role: 'DESKTOP' | 'MOBILE' | 'POSTER' | 'THUMBNAIL' | 'GALLERY' | 'OG'
  /** Repeating slots take the `id[n]` form `sync_media_usages` writes and `slotKeyOf` strips. */
  readonly repeating: boolean
  readonly desktopRatio?: AspectRatio
  readonly mobileRatio?: AspectRatio
}

/**
 * How one payload key is edited in Studio.
 *
 * DECLARED, NOT DERIVED FROM THE ZOD SCHEMA. Introspecting a schema to build a form is possible
 * and is the wrong trade here: `z.union([z.literal(2), z.literal(3), z.literal(4)])` and
 * `z.number().int().min(2).max(4)` accept nearly the same values and want completely different
 * controls, and a `z.array(z.object(...))` says nothing about whether its items are cards, steps
 * or swatches. A declaration is four lines per field and cannot be subtly wrong about intent.
 *
 * `json` IS AN HONEST ADMISSION, not a placeholder. A repeating array of cards needs a repeater
 * UI with add, remove and reorder — that is Phase 09's work. Until then the array is edited as
 * JSON, validated on save against the block's own schema, and refused rather than coerced. An
 * editor sees the real shape and a real error; what they do not see is a form that silently
 * drops the fields it could not render.
 */
export type BlockFieldKind = 'text' | 'textarea' | 'boolean' | 'number' | 'select' | 'json'

export type BlockField = {
  /** The key in `payload`. `tests/unit/cms-registry.test.ts` asserts it exists in `defaults`. */
  readonly name: string
  readonly kind: BlockFieldKind
  readonly label: string
  readonly help?: string
  /** For `select`. The VALUES are compared as strings and coerced back by the field's kind. */
  readonly options?: readonly { readonly value: string; readonly label: string }[]
  readonly min?: number
  readonly max?: number
}

export type BlockModule<Payload = unknown> = {
  readonly type: BlockType
  readonly state: BlockState
  /** Human label for the Studio block picker. Copy, so it moves to global_content in Phase 09. */
  readonly label: string
  /** One line on what the block is for, shown when adding one. */
  readonly description: string
  /** Which SEED §5 copy fields the editor renders. Chrome fields are always rendered. */
  readonly sharedFields: readonly SharedCopyField[]
  /** The block-specific `payload` shape. `z.object({})` for a block that needs none. */
  readonly schema: z.ZodType<Payload>
  /** What a newly added block starts with. Must parse against `schema`. */
  readonly defaults: Payload
  /** The editor for `payload`. Empty for a block whose payload is `z.object({})`. */
  readonly payloadFields: readonly BlockField[]
  readonly mediaSlots: readonly BlockMediaSlot[]
  /**
   * Which payload arrays hold EDITORIAL ENTRIES — the repeating items a visitor reads, each of
   * which can carry its own `key` and `owner_verification` (`lib/cms/entry-visibility.ts`).
   *
   * DECLARED BY THE BLOCK RATHER THAN INFERRED, because inference gets it wrong in both
   * directions. "An object array in the payload" sweeps in `/contact`'s form `fields`, which are a
   * schema rather than something anyone reads; "an object with a `title`" misses the commission
   * band's capabilities, which have a `label`. Both were tried. The block is the only thing that
   * actually knows, and saying so here means a test, a Studio surface and a future audit all ask
   * the same question and get the same answer.
   *
   * Empty for a block with no repeating editorial content, which is most of them.
   */
  readonly entryArrays: readonly string[]
  /** `layout_variant` values this block accepts. Empty means the column stays null. */
  readonly layoutVariants: readonly string[]
  /**
   * Pages this block may be added to, by D3 path, or `null` for "anywhere".
   *
   * Not enforced in the database — a page's block list is editorial, and a check constraint over a
   * cross-table lookup would be a trigger nobody could read. Studio filters the picker by it,
   * which is where the mistake would otherwise be made.
   */
  readonly allowedPages: readonly string[] | null
}

/**
 * A block module with its payload type erased, for the registry and anything that looks a module
 * up by a runtime string.
 *
 * `unknown`, NOT `never`. `defaults: Payload` is a covariant position, so `BlockModule<X>` is
 * assignable to `BlockModule<unknown>` for every X — and to `BlockModule<never>` for none.
 */
export type AnyBlockModule = BlockModule<unknown>
