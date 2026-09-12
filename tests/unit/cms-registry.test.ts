import { describe, expect, it } from 'vitest'

import { BLOCK_TYPES, blockTypeSchema, isBlockType } from '@/lib/cms/block-types'
import { SHARED_COPY_FIELDS } from '@/lib/cms/block-module'
import {
  addableBlocks,
  BLOCK_REGISTRY,
  BUILT_BLOCK_TYPES,
  blockModule,
  blockModuleFor,
  isBuilt,
  parseBlockPayload,
} from '@/lib/cms/registry'
import { heroBlock } from '@/content/blocks/hero'
import { planned, PLANNED_BLOCKS } from '@/content/blocks/planned'
import { categoryGridBlock } from '@/content/blocks/category-grid'
import { dividerBlock } from '@/content/blocks/divider'

describe('block type union', () => {
  it('has no duplicates', () => {
    expect(new Set(BLOCK_TYPES).size).toBe(BLOCK_TYPES.length)
  })

  it('carries the whole §08 catalogue, plus the exhibition, project and commission blocks', () => {
    // 28 from PHASE-05-09 §08, plus `signature-media` and `collection-products` — the two an
    // exhibition page needs, added in Phase 16 under amendment A14 — plus `project-gallery` and
    // `testimonial-strip`, the two the project archive needs (Phase 17), plus
    // `commission-configurator`, the band that mounts the FEAT §15 brief (Phase 19).
    // …plus `featured-collections`, the merchandised half of SEED §10-03 (Phase 22, amendment A22).
    expect(BLOCK_TYPES).toHaveLength(34)
  })

  it('validates only its own members', () => {
    expect(blockTypeSchema.safeParse('hero').success).toBe(true)
    expect(blockTypeSchema.safeParse('heroic').success).toBe(false)
    expect(isBlockType('divider')).toBe(true)
    expect(isBlockType('')).toBe(false)
    expect(isBlockType(null)).toBe(false)
  })
})

describe('registry exhaustiveness', () => {
  /**
   * The compiler already enforces this via `satisfies Record<BlockType, …>`; the test exists
   * because an `as` cast silences that check completely and invisibly —
   * `x as Record<BlockType, T> satisfies Record<BlockType, T>` compiles for any x at all. The
   * first draft of the registry had exactly that cast, and this assertion is what would have
   * caught it.
   */
  it('has an entry for every block type', () => {
    for (const type of BLOCK_TYPES) {
      expect(BLOCK_REGISTRY[type], type).toBeDefined()
    }
    expect(Object.keys(BLOCK_REGISTRY)).toHaveLength(BLOCK_TYPES.length)
  })

  it('keys each entry by its own type', () => {
    for (const type of BLOCK_TYPES) {
      expect(blockModule(type).type).toBe(type)
    }
  })

  it('resolves a database string, and refuses one that is not a block', () => {
    expect(blockModuleFor('hero')).toBe(heroBlock)
    expect(blockModuleFor('not-a-block')).toBeNull()
  })
})

describe('every block is well formed', () => {
  it('declares only real shared fields', () => {
    for (const type of BLOCK_TYPES) {
      for (const field of blockModule(type).sharedFields) {
        expect(SHARED_COPY_FIELDS, `${type}.${field}`).toContain(field)
      }
    }
  })

  it('declares each shared field at most once', () => {
    for (const type of BLOCK_TYPES) {
      const fields = blockModule(type).sharedFields
      expect(new Set(fields).size, type).toBe(fields.length)
    }
  })

  /**
   * A block whose defaults do not parse would put an invalid payload in the database the moment an
   * editor added one, and `parseBlockPayload` would then fall back to those same bad defaults
   * forever. Cheap to check, impossible to spot by eye.
   */
  it('has defaults that parse against its own schema', () => {
    for (const type of BLOCK_TYPES) {
      const block = blockModule(type)
      const parsed = block.schema.safeParse(block.defaults)
      expect(parsed.success, `${type}: ${parsed.error?.message ?? ''}`).toBe(true)
    }
  })

  it('gives every media slot a distinct id within its block', () => {
    for (const type of BLOCK_TYPES) {
      const ids = blockModule(type).mediaSlots.map((slot) => slot.id)
      expect(new Set(ids).size, type).toBe(ids.length)
    }
  })

  /**
   * A payload field naming a key the block's defaults do not have would render a control that
   * writes into nothing: the value would round-trip through the form, fail the block's own schema
   * on save, and be reported as "this block's fields are not valid" with no clue which one.
   */
  it('only declares payload fields that exist in its defaults', () => {
    for (const type of BLOCK_TYPES) {
      const block = blockModule(type)
      const keys = Object.keys(block.defaults as Record<string, unknown>)
      for (const field of block.payloadFields) {
        expect(keys, `${type}.${field.name}`).toContain(field.name)
      }
    }
  })

  it('gives every select field its options, and no others', () => {
    for (const type of BLOCK_TYPES) {
      for (const field of blockModule(type).payloadFields) {
        if (field.kind === 'select') {
          expect(field.options?.length ?? 0, `${type}.${field.name}`).toBeGreaterThan(0)
        } else {
          expect(field.options, `${type}.${field.name}`).toBeUndefined()
        }
      }
    }
  })

  it('names each payload field once per block', () => {
    for (const type of BLOCK_TYPES) {
      const names = blockModule(type).payloadFields.map((field) => field.name)
      expect(new Set(names).size, type).toBe(names.length)
    }
  })

  it('gives every block a label and a description', () => {
    for (const type of BLOCK_TYPES) {
      const block = blockModule(type)
      expect(block.label.length, type).toBeGreaterThan(0)
      expect(block.description.length, type).toBeGreaterThan(0)
    }
  })
})

describe('built and planned', () => {
  /*
   * TWENTY, IN BLOCK_TYPES ORDER — six from Phase 08, ten from Phase 11, `scale-statement` from
   * Phase 12, and the three `/large-format` needed in Phase 13.
   *
   * THE LIST RATHER THAN THE COUNT, and in order. `BUILT_BLOCK_TYPES` is `BLOCK_TYPES.filter`, so
   * its order is the canonical block order and a block that moves in that list moves here; a
   * length assertion would pass while a block was quietly swapped for another. The ten added in
   * Phase 11 are the homepage's remaining SEED §10 sections, each with a renderer registered in
   * `components/sections/registry.ts` — which `tests/unit/cms-sections.test.tsx` asserts agrees
   * with this list in both directions.
   */
  it('reports all thirty-four blocks as built', () => {
    expect(BUILT_BLOCK_TYPES).toEqual([
      'hero',
      'manifesto',
      'category-grid',
      'selected-works',
      'featured-collections',
      'material-story',
      'material-palette',
      'commission-cta',
      'three-d-resin',
      'portfolio-strip',
      'process-steps',
      'secondary-objects',
      'journal-strip',
      'final-cta',
      'statement',
      'scale-statement',
      'category-intro',
      'category-list',
      'customization-note',
      'checklist',
      'numbered-steps',
      'signature-media',
      'collection-products',
      'project-gallery',
      'testimonial-strip',
      'commission-configurator',
      'faq-list',
      'contact-details',
      // Phase 20. Its position is the catalogue's, not this list's: `contact-form` sits beside
      // `contact-details` among the query-backed blocks in `BLOCK_TYPES`.
      'contact-form',
      // Phase 45 promoted the last seven. Every position here is the catalogue's own:
      // `checklist` and `numbered-steps` sit beside `customization-note`, `faq-list` and
      // `contact-details` beside `contact-form`, and the last three after `empty-state`.
      'empty-state',
      'rich-text',
      'media-split',
      'quote',
      'divider',
    ])
  })

  it('lists no block as both built and planned', () => {
    const planned = new Set(Object.keys(PLANNED_BLOCKS))
    for (const type of BUILT_BLOCK_TYPES) {
      expect(planned.has(type), `${type} is in both lists`).toBe(false)
    }
  })

  /**
   * NOTHING IS PLANNED, AND THE ASSERTION IS STILL WORTH MAKING. Phase 13 moved the three
   * `/large-format` blocks out of the planned list; Phases 16, 17 and 19 added five more that were
   * built on arrival; Phase 20 promoted `contact-form`, the first to move from planned to built
   * rather than to arrive built; Phase 45 promoted the last seven. An empty list is the claim —
   * a block that regresses to PLANNED without anybody noticing fails here.
   */
  it('reports nothing as planned', () => {
    const planned = BLOCK_TYPES.filter((type) => !isBuilt(type))
    expect(planned).toEqual([])
    for (const type of BLOCK_TYPES) {
      expect(blockModule(type).state, type).toBe('BUILT')
    }
  })

  /**
   * A planned block declares nothing it cannot honour: no copy fields, no media, no variants.
   *
   * ASSERTED AGAINST THE HELPER RATHER THAN THE LIST, because the list is empty and a loop over it
   * would pass without testing anything — the shape of assertion that keeps reporting green after
   * the thing it was written for has gone. `planned()` is the mechanism the next unbuilt block will
   * use, so the mechanism is what this holds.
   */
  it('leaves planned blocks inert', () => {
    const block = planned('quote', 'Quote', 'A pulled quotation with an attribution.')
    expect(block.state).toBe('PLANNED')
    expect(block.sharedFields).toEqual([])
    expect(block.payloadFields).toEqual([])
    expect(block.mediaSlots).toEqual([])
    expect(block.layoutVariants).toEqual([])
    expect(block.entryArrays).toEqual([])
  })

  /**
   * BUILT IS NECESSARY BUT NO LONGER SUFFICIENT, and that changed in Phase 17.
   *
   * Every block was `allowedPages: null` until `project-gallery`, which reads the media of the
   * project whose page it sits on — so anywhere else it has no project and would render nothing at
   * all. A band that silently renders nothing is the hardest kind of empty to diagnose, so Studio
   * does not offer it there. This asserts BOTH directions: the restricted block is absent from a
   * page it does not belong on, and present on the one it does.
   */
  it('offers built blocks to an editor, minus those a page does not allow', () => {
    const addable = addableBlocks('/').map((block) => block.type)
    // Unrestricted blocks, plus the ones that name the homepage: `featured-collections` (Phase 22)
    // is addable on `/` and `/collection` and nowhere else.
    const onHomepage = BUILT_BLOCK_TYPES.filter((type) => {
      const pages = blockModule(type).allowedPages
      return pages === null || pages.includes('/')
    })

    expect(addable).toEqual(onHomepage)
    expect(addable).not.toContain('project-gallery')
    expect(addable).toContain('featured-collections')
    expect(addableBlocks('/process').map((block) => block.type)).not.toContain(
      'featured-collections',
    )
  })

  it('offers a page-restricted block on the page it belongs to', () => {
    const addable = addableBlocks('/portfolio/[slug]').map((block) => block.type)
    expect(addable).toContain('project-gallery')
  })

  it('filters by allowedPages when a block declares one', () => {
    const scoped: readonly string[] = ['/process']
    // `addableBlocks` reads the module registry, which is frozen at import; exercise its predicate.
    const allowed = (path: string | null) => path !== null && scoped.includes(path)
    expect(allowed('/process')).toBe(true)
    expect(allowed('/')).toBe(false)
    expect(allowed(null)).toBe(false)
    expect(dividerBlock.allowedPages).toBeNull()
  })
})

describe('parseBlockPayload', () => {
  it('returns the parsed payload when it matches', () => {
    const payload = { is_video: true, autoplay: false, scrim: 65 }
    expect(parseBlockPayload(heroBlock, payload)).toEqual(payload)
  })

  it('falls back to defaults rather than throwing on a mismatch', () => {
    expect(parseBlockPayload(heroBlock, { is_video: 'yes' })).toEqual(heroBlock.defaults)
    expect(parseBlockPayload(heroBlock, null)).toEqual(heroBlock.defaults)
    expect(parseBlockPayload(heroBlock, 'nonsense')).toEqual(heroBlock.defaults)
  })

  it('rejects a scrim outside 0-100', () => {
    expect(parseBlockPayload(heroBlock, { is_video: false, autoplay: false, scrim: 101 })).toEqual(
      heroBlock.defaults,
    )
  })

  /**
   * Verification step 9: a repeating block's media entries become `cards[0]`, `cards[1]`, … in
   * `media_usages`. The payload side of that contract is the reserved `media` array.
   */
  it('accepts a repeating block with indexed media references', () => {
    const payload = {
      columns: 3 as const,
      cards: [
        { title: 'Wall art', description: 'Resin on timber', href: '/wall-art', media_index: 0 },
        { title: 'Tables', description: 'River and slab', href: '/tables', media_index: 1 },
        { title: 'Objects', description: 'Smaller pieces', href: '/objects', media_index: null },
      ],
      media: [
        {
          slot: 'cards' as const,
          role: 'GALLERY' as const,
          media_id: '11111111-1111-4111-8111-111111111111',
        },
        {
          slot: 'cards' as const,
          role: 'GALLERY' as const,
          media_id: '22222222-2222-4222-8222-222222222222',
        },
      ],
    }
    const parsed = parseBlockPayload(categoryGridBlock, payload)
    expect(parsed.cards).toHaveLength(3)
    expect(parsed.media?.[1]?.media_id).toBe('22222222-2222-4222-8222-222222222222')
  })

  it('refuses a media reference that is not a uuid', () => {
    const parsed = parseBlockPayload(categoryGridBlock, {
      columns: 3,
      cards: [],
      media: [{ slot: 'cards', role: 'GALLERY', media_id: 'WALL-ART-001' }],
    })
    expect(parsed).toEqual(categoryGridBlock.defaults)
  })

  /**
   * `.loose()` on the planned schema keeps payload seeded before a renderer exists.
   *
   * Asserted against `planned()` rather than a block from the registry: every block in the
   * catalogue is BUILT since Phase 45, and a built block's schema is strict on purpose — `quote`
   * now discards `text` and keeps its own four fields, which is the behaviour the test two above
   * this one covers. The loose rule belongs to the planned MECHANISM, which is what this reads.
   */
  it('preserves unknown keys on a planned block', () => {
    const parsed = parseBlockPayload(planned('quote', 'Quote', 'A pulled quotation.'), {
      text: 'A line',
      attribution: 'A name',
    })
    expect(parsed).toEqual({ text: 'A line', attribution: 'A name' })
  })
})
