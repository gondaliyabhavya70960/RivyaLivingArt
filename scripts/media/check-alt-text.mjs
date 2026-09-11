#!/usr/bin/env node
/**
 * ALT TEXT THAT DESCRIBES THE PICTURE, NOT THE PROMPT — Phase 43, SEED §43.
 *
 * 250 assets arrived with an `alt_text_draft` that is the leading ~160 characters of the generation
 * prompt. 124 of them end mid-sentence in an ellipsis; the other 126 are complete sentences that
 * still carry the vocabulary of an instruction to a generator — "reframed to a tall vertical crop",
 * "a single soft key light", "matte black backdrop". Both fail WCAG 1.1.1 in spirit while
 * satisfying every constraint the database can express, which is why this exists as a gate rather
 * than as a column.
 *
 * IT READS THE MANIFEST, NOT THE DATABASE, and that is what lets it run in CI on a fresh clone with
 * no Postgres. The manifest is the source the drafts came from; `content/media/alt-text.ts` is
 * where the rewritten values live, and `npm run media:rewrite-alt-text` is what carries them into
 * `media_assets`. So this gate answers "has somebody written a real sentence for this asset yet",
 * which is a question about the repository, not about a deployment.
 *
 * THE RULES ARE SHARED WITH THE STUDIO. `lib/media/alt-text-quality.ts` (Phase 41) holds
 * `altTextWarnings`, and the Studio panel shows the same four findings beside the field while
 * somebody is typing. Two implementations of "bad alt text" would eventually disagree, and the one
 * an editor sees is the one that matters — so this script imports rather than restates, and adds
 * only the rules that need no typing context: a hex code and the literal string "AI".
 *
 * EXIT 1 ON ANY ASSET THAT HAS A REWRITTEN VALUE AND STILL FAILS. An asset with NO rewritten value
 * is reported as outstanding rather than as a failure — 250 sentences are a body of work, and a
 * gate that goes red until every one is done is a gate somebody disables on the first day.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * The two extra rules, beyond `altTextWarnings`.
 *
 * A HEX CODE IS A PALETTE INSTRUCTION and describes nothing to a person who cannot see the image;
 * "deep ocean blue" does. The literal "AI" is banned because an alternative that announces how the
 * picture was made spends the words a screen reader gives it on provenance rather than on subject —
 * and the provenance is already recorded, structurally, in `is_ai_generated`.
 */
const EXTRA = [
  { rule: 'HEX_CODE', test: (t) => /#[0-9a-f]{3,8}\b/i.test(t) },
  { rule: 'SAYS_AI', test: (t) => /\bAI\b|\bAI-generated\b/.test(t) },
]

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'))
}

/**
 * The rewritten values, keyed by Rivya asset id.
 *
 * ABSENT FILE IS NOT AN ERROR. Before the rewrite begins there is nothing to check and the gate
 * reports 250 outstanding, which is the honest reading of a job that has not started.
 */
async function readRewrites() {
  try {
    const loaded = await import(join(ROOT, 'content/media/alt-text.ts'))
    return loaded.ALT_TEXT ?? {}
  } catch {
    return {}
  }
}

const { altTextWarnings } = await import(join(ROOT, 'lib/media/alt-text-quality.ts'))

const manifest = readJson('data/higgsfield/asset-manifest.json')
const rewrites = await readRewrites()

const failures = []
const outstanding = []

for (const asset of manifest.assets) {
  const rewritten = rewrites[asset.rivya_asset_id]
  if (typeof rewritten !== 'string' || rewritten.trim() === '') {
    outstanding.push(asset.rivya_asset_id)
    continue
  }

  const found = altTextWarnings(rewritten)
  for (const { rule, test } of EXTRA) if (test(rewritten)) found.push(rule)

  if (found.length > 0) {
    failures.push({ id: asset.rivya_asset_id, rules: found })
  }
}

if (failures.length > 0) {
  console.error(`✗ alt text: ${String(failures.length)} rewritten value(s) still fail:`)
  for (const failure of failures.slice(0, 30)) {
    console.error(`    ${failure.id.padEnd(28)} ${failure.rules.join(', ')}`)
  }
  if (failures.length > 30) console.error(`    … and ${String(failures.length - 30)} more`)
  console.error(
    '\n  The finished value describes what is VISIBLE, in one sentence, with no prompt vocabulary,\n' +
      '  no hex code, no camera language, no trailing ellipsis and no "AI". See SEED §43 and\n' +
      '  lib/media/alt-text-quality.ts, which the Studio panel shows to an editor as they type.',
  )
  process.exit(1)
}

const done = manifest.assets.length - outstanding.length
console.log(
  `✓ alt text: ${String(done)} of ${String(manifest.assets.length)} asset(s) rewritten and clean` +
    (outstanding.length > 0
      ? `; ${String(outstanding.length)} still carry their imported draft (${outstanding.slice(0, 3).join(', ')}${outstanding.length > 3 ? ', …' : ''})`
      : ''),
)
