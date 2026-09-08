#!/usr/bin/env node
/**
 * Writes the generated sections of `docs/media/HIGGSFIELD_ASSET_STATUS.md`.
 *
 * IT READS THE MANIFEST AND NOTHING ELSE — no database, no network. That is a requirement rather
 * than a simplification: the phase's verification step 10 is
 * `npm run media:build-status && git diff --exit-code`, which runs in CI, and a generator whose
 * output depended on how many rows `media_assets` happened to hold would produce a document that
 * differs between a developer's machine, CI and production. A document that cannot be regenerated
 * identically is not a generated document; it is a document with a script attached.
 *
 * SO "Used?" AND "CMS placement" READ FROM THE MANIFEST'S OWN FIELDS, which are `false` and `null`
 * on all 250 and will stay that way — the manifest records what was generated, not what the CMS
 * does with it. The live answer to both is in the Studio at `/studio/media/higgsfield`, which
 * joins `media_usages`. §2 of the document says so; this comment is why.
 *
 * IT REPLACES MARKED REGIONS, NOT THE FILE. §1, §2, §5–§9 are hand-written analysis — the data
 * quality findings, the status vocabulary, the reasoning about resolution fit — and regenerating
 * the whole document would either delete them or move that prose into this script. Neither is
 * acceptable, so the generator owns exactly what lies between its markers and cannot touch a
 * character outside them.
 *
 * Usage: npm run media:build-status
 */
import { readFileSync, writeFileSync } from 'node:fs'

import { purposeFor } from '../../content/asset-purposes'
import { readManifest, type ManifestAsset } from '../../lib/media/manifest'

const DOC_PATH = 'docs/media/HIGGSFIELD_ASSET_STATUS.md'
const PROMPT_LIMIT = 100

function begin(name: string): string {
  return `<!-- BEGIN GENERATED: ${name} -->`
}
function end(name: string): string {
  return `<!-- END GENERATED: ${name} -->`
}

/**
 * Markdown table cells are pipe-delimited, and a prompt containing a pipe would silently split a
 * row into two columns and shift every cell after it. Newlines do the same to the row itself.
 */
function cell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim()
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit).trimEnd()}…`
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/** Descending by count, then by name — so the table is stable across runs. */
function ranked(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function longEdge(asset: ManifestAsset): number {
  return Math.max(asset.width, asset.height)
}

function familySummary(assets: readonly ManifestAsset[]): string {
  const families = new Map<string, ManifestAsset[]>()
  for (const asset of assets) {
    const list = families.get(asset.family)
    if (list) list.push(asset)
    else families.set(asset.family, [asset])
  }

  const rows = [...families.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([family, list]) => {
      const images = list.filter((a) => a.type === 'image').length
      // Ratios in descending frequency, so the family's dominant shape reads first.
      const ratios = ranked(countBy(list, (a) => a.aspect_ratio))
        .map(([r]) => r)
        .join(', ')
      const folders = [...new Set(list.map((a) => a.cloudinary_folder))].sort()
      return (
        `| \`${family}\` | ${String(list.length)} | ${String(images)} | ` +
        `${String(list.length - images)} | ${ratios} | ` +
        `${String(Math.max(...list.map(longEdge)))} | ` +
        `${folders.map((f) => `\`${f}\``).join(' · ')} | \`${purposeFor(family) ?? 'UNCLASSIFIED'}\` |`
      )
    })

  const images = assets.filter((a) => a.type === 'image').length
  const folderCount = new Set(assets.map((a) => a.cloudinary_folder)).size
  const purposeCount = new Set(assets.map((a) => purposeFor(a.family))).size

  return [
    '| Family | n | Img | Vid | Ratios present | Max long edge | Folder | Purpose |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    `| **Total** | **${String(assets.length)}** | **${String(images)}** | ` +
      `**${String(assets.length - images)}** | ` +
      `${String(new Set(assets.map((a) => a.aspect_ratio)).size)} ratios | ` +
      `${String(Math.max(...assets.map(longEdge)))} | ${String(folderCount)} folders | ` +
      `${String(purposeCount)} purposes |`,
  ].join('\n')
}

function distribution(assets: readonly ManifestAsset[]): string {
  const list = (counts: Map<string, number>): string =>
    ranked(counts)
      .map(([k, n]) => `\`${k}\` ${String(n)}`)
      .join(' · ')

  const videos = assets.filter((a) => a.type === 'video')
  const durations = countBy(videos, (a) => `${String(a.duration_s ?? 0)} s`)
  const resolutions = countBy(videos, (a) => `${String(a.width)}×${String(a.height)}`)

  return [
    '| Cut | Values |',
    '|---|---|',
    `| By type | image ${String(assets.length - videos.length)} · video ${String(videos.length)} |`,
    `| By aspect ratio | ${list(countBy(assets, (a) => a.aspect_ratio))} |`,
    `| By page | ${list(countBy(assets, (a) => a.page))} |`,
    `| By model | ${list(countBy(assets, (a) => a.higgsfield_model))} |`,
    `| By purpose | ${list(countBy(assets, (a) => purposeFor(a.family) ?? 'UNCLASSIFIED'))} |`,
    `| Video durations | ${list(durations)} |`,
    `| Video resolutions | ${list(resolutions)} |`,
  ].join('\n')
}

function inventory(assets: readonly ManifestAsset[]): string {
  // Sorted by asset id rather than manifest order: a rebuild that reorders the JSON must not
  // reorder 250 rows in a committed document and bury the one real change in the diff.
  const rows = [...assets]
    .sort((a, b) => a.rivya_asset_id.localeCompare(b.rivya_asset_id))
    .map((asset) =>
      [
        `\`${asset.rivya_asset_id}\``,
        asset.type,
        `\`${asset.family}\``,
        asset.page,
        asset.section,
        `\`${purposeFor(asset.family) ?? 'UNCLASSIFIED'}\``,
        asset.source,
        `\`${asset.higgsfield_model}\``,
        asset.aspect_ratio,
        `${String(asset.width)}×${String(asset.height)}`,
        cell(truncate(asset.prompt, PROMPT_LIMIT)),
        `\`${asset.status}\``,
        asset.used_in_cms ? 'yes' : 'no',
        `\`${asset.cloudinary_public_id}\``,
        asset.cms_placement === null ? '—' : cell(asset.cms_placement),
      ].join(' | '),
    )
    .map((row) => `| ${row} |`)

  return [
    '| Asset ID | Type | Family | Page | Section | Purpose | Source | Model | Ratio | Pixels | ' +
      'Prompt (first 100 chars) | Status | Used? | Cloudinary location | CMS placement |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

/** Replace exactly what lies between the markers, leaving both markers in place. */
function replaceRegion(document: string, name: string, body: string): string {
  const open = begin(name)
  const close = end(name)
  const start = document.indexOf(open)
  const finish = document.indexOf(close)

  if (start === -1 || finish === -1 || finish < start) {
    throw new Error(
      `${DOC_PATH} is missing the generated region "${name}".\n` +
        `Expected a "${open}" line followed by a "${close}" line. The document owns the prose ` +
        'around these markers and this generator owns what is between them; without them it ' +
        'cannot tell the two apart, and it will not guess.',
    )
  }

  return `${document.slice(0, start + open.length)}\n\n${body}\n\n${document.slice(finish)}`
}

const manifest = readManifest()

let document = readFileSync(DOC_PATH, 'utf8')
document = replaceRegion(document, 'family-summary', familySummary(manifest.assets))
document = replaceRegion(document, 'distribution', distribution(manifest.assets))
document = replaceRegion(document, 'asset-inventory', inventory(manifest.assets))

writeFileSync(DOC_PATH, document)

console.log(
  `✓ ${DOC_PATH}: ${String(manifest.assets.length)} assets across ` +
    `${String(new Set(manifest.assets.map((a) => a.family)).size)} families ` +
    `(manifest ${manifest.manifest_version})`,
)
