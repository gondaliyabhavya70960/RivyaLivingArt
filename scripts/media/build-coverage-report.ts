#!/usr/bin/env node
/**
 * Writes the generated Coverage table of `docs/media/HIGGSFIELD_ASSET_STATUS.md` — Phase 43.
 *
 * WHAT PHASE 07 COULD NOT DO. It produced a PROJECTED gap list before most slots existed: the
 * analysis was sound and the slots were not there to join against. Phases 09–22 then created the
 * real slots and bound what they could. This script re-runs the analysis against reality — every
 * declared slot in `content/media-slots.ts`, against the 250 assets actually in the manifest — and
 * prints one of the four dispositions for each.
 *
 * IT READS TWO COMMITTED FILES AND NOTHING ELSE, exactly as `build-asset-status.ts` does and for
 * the same reason: `npm run media:check-coverage` is `generate && git diff --exit-code`, run in CI,
 * and a generator whose output depended on how many rows `media_usages` happened to hold would
 * produce a different document on a developer's machine, in CI and in production. A document that
 * cannot be regenerated identically is not a generated document.
 *
 * WHICH IS WHY BOUND-ASSET STATE IS NOT HERE. "Which concept asset is bound to a published slot"
 * is a live question about the database, and its answer belongs on the Studio's Concept Placement
 * tab, where it is read fresh and where the person who can act on it is looking. §8 of the document
 * says so rather than carrying a stale table that looks authoritative.
 *
 * THE DISPOSITION IS A PROPOSAL, NOT A DECISION, and the table says which of the four decision-gate
 * questions the data could answer. Two of the four — is there real Rivya media, does a crop destroy
 * the subject — can only be answered by a person looking at a picture, so they print as `—` rather
 * than as a guess. A generator that filled them in would be asserting it had looked.
 *
 * Usage: npx tsx scripts/media/build-coverage-report.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'

import { MEDIA_SLOTS } from '../../content/media-slots'
import { proposeDispositions, presetWidthFor, type DispositionProposal } from '../../lib/media/gaps'
import { readManifest } from '../../lib/media/manifest'

const DOC_PATH = 'docs/media/HIGGSFIELD_ASSET_STATUS.md'
const REGION = 'coverage'

function begin(name: string): string {
  return `<!-- BEGIN GENERATED: ${name} -->`
}
function end(name: string): string {
  return `<!-- END GENERATED: ${name} -->`
}

/** Pipes split a Markdown row; a slot label or a reason containing one would shift every cell. */
function cell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim()
}

/**
 * The four decision-gate questions, in D6's order, as the data can answer them.
 *
 * Q1 and Q2 are `—` ALWAYS AND ON PURPOSE. Whether real Rivya media exists, and whether the owner
 * has supplied an approved asset, are facts about the business that live in `media_assets.source`
 * — and the whole library is `HIGGSFIELD` today, so a generated "no" would be true by accident
 * rather than by inspection. When a real photograph arrives it arrives as a row, and the honest
 * place to see it is the Studio.
 */
function gate(proposal: DispositionProposal): string {
  const q3 = proposal.candidateCount > 0 ? `yes (${String(proposal.candidateCount)})` : 'no'
  const q4 =
    proposal.candidateCount === 0
      ? 'n/a'
      : proposal.resolution === 'UPSCALES'
        ? 'no — every candidate upscales'
        : '—'
  return `— · — · ${q3} · ${q4}`
}

function coverageTable(proposals: readonly DispositionProposal[]): string {
  const rows = proposals.map((p) => {
    const ratios = `${p.slot.desktopRatio} / ${p.slot.mobileRatio}`
    const native = `${String(p.nativeDesktop)} / ${String(p.nativeMobile)}`
    const px = p.widestPx === null ? '—' : `${String(p.widestPx)}px`
    const fit =
      p.resolution === 'UNKNOWN'
        ? '—'
        : `${p.resolution} (needs ${String(presetWidthFor(p.slot))}px)`
    return `| \`${cell(p.slot.key)}\` | ${cell(p.slot.page)} | ${p.slot.kind} | ${ratios} | ${String(p.candidateCount)} | ${native} | ${px} | ${fit} | **${p.proposed}** | ${cell(p.because)} | ${gate(p)} |`
  })

  const counts = new Map<string, number>()
  for (const p of proposals) counts.set(p.proposed, (counts.get(p.proposed) ?? 0) + 1)
  const summary = ['REUSE_FROM_FAMILY', 'RECROP_EXISTING', 'GENERATE_NEW', 'LEAVE_EMPTY']
    .map((d) => `${d} ${String(counts.get(d) ?? 0)}`)
    .join(' · ')

  return [
    `**${String(proposals.length)} declared slots.** ${summary}.`,
    '',
    'The last column is the decision gate, in D6 order: real Rivya media · approved owner asset ·',
    'existing manifest family · re-croppable. The first two print `—` because they are facts about',
    'the business rather than about the library — see this script’s header.',
    '',
    '| Slot | Page | Kind | Ratios (desktop/mobile) | Candidates | Native at each ratio | Widest | Resolution fit | Proposed | Why | Decision gate |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

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
const proposals = proposeDispositions({ assets: manifest.assets, bindings: [], slots: MEDIA_SLOTS })

let document = readFileSync(DOC_PATH, 'utf8')
document = replaceRegion(document, REGION, coverageTable(proposals))
writeFileSync(DOC_PATH, document)

const generate = proposals.filter((p) => p.proposed === 'GENERATE_NEW').length
console.log(
  `✓ ${DOC_PATH}: ${String(proposals.length)} declared slot(s) against ` +
    `${String(manifest.assets.length)} manifest assets; ${String(generate)} propose GENERATE_NEW`,
)
