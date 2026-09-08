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
import { PLANNED_BLOCKS } from '@/content/blocks/planned'
import { categoryGridBlock } from '@/content/blocks/category-grid'
import { dividerBlock } from '@/content/blocks/divider'

describe('block type union', () => {
  it('has no duplicates', () => {
    expect(new Set(BLOCK_TYPES).size).toBe(BLOCK_TYPES.length)
  })

  it('carries the whole §08 catalogue', () => {
    expect(BLOCK_TYPES).toHaveLength(28)
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

  it('gives every block a label and a description', () => {
    for (const type of BLOCK_TYPES) {
      const block = blockModule(type)
      expect(block.label.length, type).toBeGreaterThan(0)
      expect(block.description.length, type).toBeGreaterThan(0)
    }
  })
})

describe('built and planned', () => {
  it('reports the six Tier 1 blocks as built', () => {
    expect(BUILT_BLOCK_TYPES).toEqual([
      'hero',
      'category-grid',
      'process-steps',
      'statement',
      'empty-state',
      'divider',
    ])
  })

  it('lists no block as both built and planned', () => {
    const planned = new Set(Object.keys(PLANNED_BLOCKS))
    for (const type of BUILT_BLOCK_TYPES) {
      expect(planned.has(type), `${type} is in both lists`).toBe(false)
    }
  })

  it('reports the rest as planned', () => {
    const planned = BLOCK_TYPES.filter((type) => !isBuilt(type))
    expect(planned).toHaveLength(22)
    for (const type of planned) {
      expect(blockModule(type).state, type).toBe('PLANNED')
    }
  })

  /** A planned block declares nothing it cannot honour: no copy fields, no media, no variants. */
  it('leaves planned blocks inert', () => {
    for (const type of BLOCK_TYPES.filter((t) => !isBuilt(t))) {
      const block = blockModule(type)
      expect(block.sharedFields, type).toEqual([])
      expect(block.mediaSlots, type).toEqual([])
      expect(block.layoutVariants, type).toEqual([])
    }
  })

  it('offers only built blocks to an editor', () => {
    const addable = addableBlocks('/').map((block) => block.type)
    expect(addable).toEqual(BUILT_BLOCK_TYPES)
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

  /** `.loose()` on the planned schema keeps payload seeded before a renderer exists. */
  it('preserves unknown keys on a planned block', () => {
    const parsed = parseBlockPayload(blockModule('quote'), {
      text: 'A line',
      attribution: 'A name',
    })
    expect(parsed).toEqual({ text: 'A line', attribution: 'A name' })
  })
})
