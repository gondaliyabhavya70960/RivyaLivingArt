import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MEDIA_SLOTS } from '@/content/media-slots'
import { MEDIA_BINDINGS } from '@/content/seed/media-bindings'

/**
 * THE BINDINGS RESOLVE, WITHOUT A DATABASE.
 *
 * `content/seed/media-bindings.ts` names assets by `rivya_asset_id` and slots by registry key, and
 * both are plain strings. A typo in either is caught today only by `npm run seed:bind-media`, which
 * needs a live `media_assets` table — so on a developer's machine, in CI, and in every unit run, a
 * misspelled id is indistinguishable from a correct one until somebody seeds a database.
 *
 * The manifest and the slot registry are both committed files. That makes the check free and makes
 * it belong here: a binding that names something which does not exist is a mistake, and a mistake
 * that only a database can see is one that ships.
 *
 * IT ASSERTS RESOLUTION, NOT TASTE. Which photograph belongs beside which headline is an editorial
 * judgement no test can hold. Whether the photograph exists is not.
 */
const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'higgsfield', 'asset-manifest.json'), 'utf8'),
) as { readonly assets: readonly { readonly rivya_asset_id: string }[] }

const assetIds = new Set(manifest.assets.map((asset) => asset.rivya_asset_id))
const slotKeys = new Set(MEDIA_SLOTS.map((slot) => slot.key))

const bindings = Object.entries(MEDIA_BINDINGS)

describe('the media bindings', () => {
  it('name a slot the registry declares', () => {
    for (const [section, binding] of bindings) {
      expect(slotKeys, `${section} binds slot "${binding.slotKey}"`).toContain(binding.slotKey)
    }
  })

  it('name assets the manifest holds', () => {
    for (const [section, binding] of bindings) {
      for (const role of ['desktop', 'mobile'] as const) {
        const id = binding[role]
        if (id === undefined) continue
        expect(assetIds, `${section}.${role} binds "${id}"`).toContain(id)
      }
    }
  })

  it('bind a desktop asset wherever they bind a mobile one', () => {
    // A mobile-only binding renders the mobile asset at BOTH widths — `ResponsiveMedia` falls back
    // to whichever half is set. That is right for an editor who chose one picture and wrong as an
    // accident, so the asymmetry has to be deliberate rather than a half-finished row.
    for (const [section, binding] of bindings) {
      if (binding.mobile === undefined) continue
      expect(binding.desktop, `${section} binds a mobile asset but no desktop one`).toBeDefined()
    }
  })

  it('leave the homepage hero VIDEO unbound, and bind the still to a room', () => {
    /*
     * THIS TEST USED TO REFUSE BOTH HALVES, AND HALF OF THAT REFUSAL WAS RIGHT FOR A PLAN THAT NO
     * LONGER HOLDS. The old reasoning: both home hero slots are GENERATE_NEW, no family can fill
     * either, and "reaching for a material macro because the most important frame on the site is
     * empty" is the substitution `media-bindings.ts` forbids in its own header.
     *
     * THE MACRO HALF OF THAT ARGUMENT STILL STANDS AND IS WHAT THE SECOND ASSERTION KEEPS. What
     * changed is the brief: the public redesign guide §6.1 specifies the homepage hero as a
     * full-bleed STILL of a dining or conference plane, so the poster is no longer "the video's
     * opening frame" waiting on a video, and §8 says reuse the manifest before generating. A
     * room-scale dining plane is not a macro texture standing in for a room — it is the subject.
     *
     * `home.hero.video` STAYS UNBOUND. No video exists, none is briefed, and nothing in the
     * manifest is one.
     */
    const bound = new Set(bindings.map(([, binding]) => binding.slotKey))
    expect(bound).not.toContain('home.hero.video')
    expect(bound).toContain('home.hero.poster')

    // And what it is bound to is a room, not a swatch: the guard the old test was really for.
    const hero = bindings.find(([, binding]) => binding.slotKey === 'home.hero.poster')?.[1]
    expect(hero?.desktop).toMatch(/^LARGEFORMAT-/u)
    expect(hero?.mobile).toMatch(/^LARGEFORMAT-/u)
  })

  it('leave every EMPTY_STATE slot unbound', () => {
    // `portfolio.project`, `faq.hero` and `search.empty` are declared EMPTY_STATE. Filling one
    // asserts a delivered project or a capability nobody has confirmed.
    const empty = new Set(
      MEDIA_SLOTS.filter((slot) => slot.resolution === 'EMPTY_STATE').map((slot) => slot.key),
    )
    expect(empty.size).toBeGreaterThan(0)
    for (const [section, binding] of bindings) {
      expect(empty, `${section} binds the EMPTY_STATE slot "${binding.slotKey}"`).not.toContain(
        binding.slotKey,
      )
    }
  })
})
