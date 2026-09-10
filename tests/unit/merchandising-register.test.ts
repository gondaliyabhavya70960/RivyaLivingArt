import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  D3_CATEGORY_SLUGS,
  EDITORIAL_CTA_PATHS,
  MERCHANDISING_SLOTS,
  OWNING_STUDIO_ROUTES,
  categorySlotKey,
  isEditorialCtaPath,
} from '@/lib/cms/merchandising-register'

/**
 * The register, the migration and the renderers agree.
 *
 * THE MIGRATION AND THE REGISTER ARE TWO COPIES OF ONE LIST, and this is what keeps them one. A
 * key in code that no row carries resolves to UNKNOWN_SLOT; a row no route reads is a list nobody
 * renders. The four global rows are read out of `0200`'s VALUES clause; the seven category rows
 * come from the trigger's key rule applied to the seeded categories, so they are checked against
 * the same rule in TypeScript.
 *
 * THE LAST TEST IS THE RISK TABLE'S SECOND ROW: no product slug is written in code. It reads every
 * renderer and pattern for a `/product/<something>` literal. The catalogue's own card component
 * builds its href from a row; a literal there is somebody making the design look full.
 */
const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '0200_phase22_merchandising.sql'),
  'utf8',
)

describe('the eleven slots', () => {
  it('are four global slots plus one per D3 category', () => {
    expect(MERCHANDISING_SLOTS).toHaveLength(11)
    expect(
      MERCHANDISING_SLOTS.filter((slot) => slot.key.startsWith('CATEGORY_PINNED_')),
    ).toHaveLength(7)
    expect(D3_CATEGORY_SLUGS).toHaveLength(7)
  })

  it('have unique keys, one surface each, and one owning screen each', () => {
    const keys = MERCHANDISING_SLOTS.map((slot) => slot.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const slot of MERCHANDISING_SLOTS) {
      expect(slot.surface.startsWith('/')).toBe(true)
      expect(OWNING_STUDIO_ROUTES).toContain(slot.owningStudioRoute)
      expect(slot.entityTypes.length).toBeGreaterThan(0)
      expect(slot.minItems).toBeGreaterThanOrEqual(1)
    }
  })

  it('name HOMEPAGE_FEATURED_COLLECTIONS as the only featured-collections slot', () => {
    const featured = MERCHANDISING_SLOTS.filter(
      (slot) => slot.entityTypes.includes('COLLECTION') && slot.surface === '/',
    )
    expect(featured.map((slot) => slot.key)).toEqual(['HOMEPAGE_FEATURED_COLLECTIONS'])
    expect(MERCHANDISING_SLOTS.some((slot) => slot.key === 'FEATURED_COLLECTIONS')).toBe(false)
  })

  it('derive the category keys mechanically: upper-cased, dashes to underscores', () => {
    expect(categorySlotKey('wall-statement-art')).toBe('CATEGORY_PINNED_WALL_STATEMENT_ART')
    expect(categorySlotKey('3d-resin')).toBe('CATEGORY_PINNED_3D_RESIN')
    for (const slug of D3_CATEGORY_SLUGS) {
      const spec = MERCHANDISING_SLOTS.find((slot) => slot.key === categorySlotKey(slug))
      expect(spec?.surface).toBe(`/collection/${slug}`)
      expect(spec?.owningStudioRoute).toBe('/studio/merchandising/store')
      expect(spec?.fallback).toBe('SHOW_EMPTY_STATE')
    }
  })

  it('match the rows migration 0200 inserts, with the same minimums and fallback modes', () => {
    for (const slot of MERCHANDISING_SLOTS.filter(
      (candidate) => !candidate.key.startsWith('CATEGORY_PINNED_'),
    )) {
      const row = new RegExp(
        `\\('${slot.key}',[\\s\\S]*?'${slot.surface.replace('/', '\\/')}', '${slot.owningStudioRoute}',[\\s\\S]*?${slot.minItems}, \\d+, '${slot.fallback}'\\)`,
      )
      expect(MIGRATION, slot.key).toMatch(row)
    }
    // The category rows come from one rule in SQL and one in TypeScript; both must read the same.
    expect(MIGRATION).toContain("'CATEGORY_PINNED_' || upper(replace(p_slug, '-', '_'))")
    expect(MIGRATION).toMatch(/after insert or update of slug on public\.categories/)
  })

  it('offers no behavioural ordering anywhere in the resolver', () => {
    // Comments explain what is NOT here and name it; the code must not.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const resolver = stripComments(
      readFileSync(join(process.cwd(), 'lib', 'cms', 'merchandising.ts'), 'utf8'),
    )
    const repository = stripComments(
      readFileSync(
        join(process.cwd(), 'lib', 'supabase', 'repositories', 'merchandising.ts'),
        'utf8',
      ),
    )
    for (const word of [
      'popular',
      'trending',
      'best_selling',
      'bestselling',
      'view_count',
      'random(',
    ]) {
      expect(resolver.toLowerCase(), word).not.toContain(word)
      expect(repository.toLowerCase(), word).not.toContain(word)
    }
    expect(repository).toContain("order('published_at'")
  })
})

describe('editorial tiles', () => {
  it('may link only to the three destinations the phase document allows', () => {
    expect([...EDITORIAL_CTA_PATHS]).toEqual([
      '/large-format',
      '/collection',
      '/custom-commissions',
    ])
    expect(isEditorialCtaPath('/collection')).toBe(true)
    expect(isEditorialCtaPath('/collection/furniture')).toBe(false)
    expect(isEditorialCtaPath('/product/anything')).toBe(false)
    expect(isEditorialCtaPath(null)).toBe(false)
  })
})

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...tsxFiles(path))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(path)
  }
  return out
}

describe('no product slug is written in code', () => {
  it('finds no /product/<slug> literal in components/sections or components/patterns', () => {
    const files = [
      ...tsxFiles(join(process.cwd(), 'components', 'sections')),
      ...tsxFiles(join(process.cwd(), 'components', 'patterns')),
    ]
    expect(files.length).toBeGreaterThan(20)
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      // A literal product path with a slug after it. `/product/${…}` and `/product/` alone are
      // hrefs built from a row and are fine; `/product/oak-table` is somebody's shortcut.
      const matches = source.match(/['"`]\/product\/[a-z0-9][a-z0-9-]*['"`]/g)
      if (matches !== null) offenders.push(`${file}: ${matches.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })
})
