---
name: media-binding
description: Use when binding an image or video to a page section, adding a media slot, diagnosing empty media frames, or touching the seed runner's media path. Encodes the registry-key rule, delivery widths, and why published sections used to get no pictures.
---

# Media binds by registry key, verbatim

## Asset priority, in order

Real Rivya media → approved owner asset → **existing Higgsfield asset** → existing render → new
generation → technical fallback.

250 Higgsfield assets already exist, catalogued in `data/higgsfield/asset-manifest.json`.
**Regenerating something already in the manifest is a defect, not a shortcut.**

## A binding names a slot that exists

`page_sections.media_slot_key` must be a key `content/media-slots.ts` declares, **verbatim**
(migration 0050). `sync_media_usages` copies it into the reverse index, so an invented key produces
a row pointing at a slot nothing declares.

Need a new slot? Add it to the registry first. **Do not reuse a neighbouring slot** — binding a hero
to a category card slot makes `classify()` report that card FILLED while it is still empty, and a
false coverage report is worse than a true gap.

## Delivery width is declared, not sniffed

`MediaSlot.delivery` is `'HERO' | 'GRID' | 'CARD'`. It used to be inferred from whether the key
contained the word "hero", which was silently wrong for any full-bleed band without that word in its
name.

The resolution arithmetic, settled: `srcSet(box)` returns ladder rungs between `snapWidth(box)` and
`snapWidth(box × 2)`.

- **grid** (base 768) → 768 · 1024 · 1280 · 1536. The ceiling is **1536**, not the ladder's 2560.
- **hero** (base 1600) → 1920 · 2560. A hero source under **1920** upscales in every delivery.

## The constraint that requires two columns written together

Migration 0050: `media_slot_key IS NOT NULL OR (both ids IS NULL)`. The slot key is a hashed
`fields` entry, so a write that sets ids alone on a row whose key is NULL **violates the check** —
and because the seed runner takes one transaction per module, that rolls back the entire module
rather than skipping a row.

## Why published sections got no pictures (amendment A49)

Rule 5c stands the seed runner down on a row a person published:
`row.status === 'PUBLISHED' && seededStatus !== 'PUBLISHED'`. Section modules seed **DRAFT** and
every live environment publishes them — so the guard skipped every visible section, media columns
included. The rebind existed and sat *below* the guard, reachable only for rows nobody could see.

**Rule 5d** now runs ahead of the guard, restricted to columns that are **NULL**, writing the slot
key alongside. NULL is an absence, not a decision — nobody opens Studio and chooses to have no
image. A column an editor *has* filled is never replaced, even when the module names another asset.

## Diagnosing an empty frame

Count `[data-media-fallback]`, not `[data-rv-media-fallback]` — the wrong selector once reported
zero wells everywhere.

Then check, in order: is the section's `media_desktop_id` set? is the asset in `media_assets` on
*this* database (the manifest is not the table)? is `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` set — an
empty cloud name turns every bound asset into a well? and finally: **is the page a stale
prerender?** A data-only change needs `rm -rf .next`, not `rm -rf .next/cache`.

## Read before editing

`docs/media/MEDIA_GUIDE.md` §6 and §6.1 (the production runbook), `docs/architecture/CANONICAL-DECISIONS.md` D6.
