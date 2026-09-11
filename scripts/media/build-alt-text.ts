#!/usr/bin/env node
/**
 * Derives a first real sentence for each of the 250 assets, into `content/media/alt-text.ts`.
 *
 * WHAT IS WRONG WITH THE VALUES IT REPLACES. All 250 `alt_text_draft`s are the leading ~160
 * characters of the generation prompt, cut at a character count: 124 end mid-clause in an ellipsis
 * and describe nothing, and the other 126 are complete sentences that carry the prompt's
 * INSTRUCTIONS along with its subject — "warm side light", "no people", "palette limited to deep
 * ocean and champagne". A screen-reader user is read the lighting rig.
 *
 * WHAT THIS DOES, AND THE HONEST LIMIT OF IT. A Higgsfield prompt is written as a SCENE followed by
 * instructions, and the two are separated by a literal em-dash in every one of the 250. So the
 * derivation is: keep the scene, drop everything from the em-dash on, drop the remaining
 * instruction clauses by name, and finish the sentence at a clause boundary rather than at a
 * character count. That is exactly the edit the phase document asks an editor to make, made
 * mechanically and inspectably.
 *
 * IT IS A DRAFT AND THE DOCUMENTATION SAYS SO. A prompt describes what was ASKED FOR; only somebody
 * looking at the picture can say what arrived. Every value stays `OWNER_VERIFICATION_REQUIRED`, the
 * Studio's alt-text queue orders bound assets first, and `content/media/alt-text.ts` is a committed
 * TypeScript file precisely so that a human edit to any line is a reviewable diff rather than a
 * database change nobody can see. What this script buys is that all 250 start from a true, readable
 * sentence instead of from a fragment — not that the job is finished.
 *
 * Usage: npx tsx scripts/media/build-alt-text.ts
 */
import { existsSync, writeFileSync } from 'node:fs'

import { format, resolveConfig } from 'prettier'

import { altTextWarnings } from '../../lib/media/alt-text-quality'
import { readManifest, type ManifestAsset } from '../../lib/media/manifest'

const OUT_PATH = 'content/media/alt-text.ts'

/** The longest a text alternative should be. Past this a screen reader is reading an essay. */
const MAX = 220

/**
 * Clauses that instruct the generator rather than describe the picture.
 *
 * MATCHED AS WHOLE CLAUSES, between commas, never as substrings. "no people" is an instruction;
 * "no people" inside "a room with no people in it" would be a description, and a substring match
 * would mangle it. Every entry here was read off the actual prompts.
 */
const INSTRUCTION_CLAUSE =
  /^(?:no (?:people|faces|text|logos|hands|figures)|palette limited to.*|warm side light|low raking light|soft (?:key|side|top) light|even light|shot on .*|photographed straight on|seen from the doorway|generous empty ground.*|the light low and even.*|everything used rather than new)$/i

/**
 * What an instruction segment OPENS with, after an em-dash.
 *
 * Read off the corpus: every one of the 250 ends with a palette directive, and most add a "no
 * people" or a lighting note first. A segment starting with any of these is where the description
 * stops and the instruction begins.
 */
const INSTRUCTION_OPENER =
  /^(?:palette|no |warm |low |soft |even |lit |shot |cinematic|photorealistic|hyperrealistic|ultra|high detail|8k|4k|the light |everything used|generous |reframed|cropped to|editorial photograph|macro |extreme )/i

/**
 * A clause that is only a camera setting.
 *
 * `PROCESS-TIMBER-004` opens with three of them — "camera at standing height", "looking slightly
 * down at a 30 degree angle", "50mm lens" — before the subject appears. They are dropped as whole
 * clauses so the subject survives intact.
 */
const CAMERA_CLAUSE =
  /(?:\bcamera\b|\d*\s*mm lens\b|\blighting\b|^editorial photograph$|\bdegree angle\b|\blocked-off\b|\bbokeh\b|\baspect ratio\b|\bphotography for\b|\bphotograph for\b|\bstudio lighting\b|\bdepth of field\b|\bstudio ambiance\b|\bambiance\b)/i

/**
 * Phrases that are instructions wherever they appear, and can be removed in place.
 *
 * THE LIGHTING RIG IS THE BIGGEST ONE. "under a single soft key light" appears in 86 of the 250
 * prompts and describes the equipment rather than the scene: a reader who cannot see the picture
 * learns nothing from it, and `altTextWarnings` rejects it by name. "Reframed to a tall vertical
 * crop" is worse — it is an instruction about the FRAME, addressed to a generator that no longer
 * exists by the time anybody reads this.
 */
const INSTRUCTION_PHRASE: readonly (readonly [RegExp, string])[] = [
  [/\s*,?\s*no (?:people|faces|text|logos|hands|watermarks?|signature)\b/gi, ''],
  // Loop and delivery directives: how the file behaves, never what it shows.
  [/\s*,?\s*seamless loop(?:ing)?\b/gi, ''],
  [/\s*,?\s*(?:perfectly\s+)?loopable\b/gi, ''],
  // A shot-type preamble. "Emotional wide still" is a brief to a photographer, not a subject.
  /*
   * A SHOT-TYPE PREAMBLE, WITH THE STYLE WORDS THAT TRAVEL WITH IT. The corpus writes "emotional
   * cinematic wide still, …" and "dramatic close shot, …": a brief to a photographer, not a
   * subject. The optional middle group is why this is written as one pattern rather than relying on
   * the style-word removals further down — those run AFTER this, so at this point "cinematic" is
   * still sitting between "emotional" and "wide".
   */
  [
    /^(?:(?:emotional|dramatic|intimate|quiet|serene|cinematic|photorealistic|hyperrealistic)\s+)*(?:wide|tight|close|medium)\s+(?:still|shot),\s*/gi,
    '',
  ],
  // A market positioning clause. "Premium Indian craft context" describes an audience.
  [/\s*,?\s*premium[^,.]*context\b/gi, ''],
  [/\s*,?\s*palette limited to[^,.]*/gi, ''],
  [/\s*,?\s*photographed straight on\b/gi, ''],
  [/\s*,?\s*shot on [^,.]*/gi, ''],
  // The rig, in every spelling the corpus uses.
  [
    /\s*,?\s*(?:under|catching|lit by|in)\s+(?:the\s+same\s+)?(?:a\s+)?(?:single\s+)?(?:soft\s+|hard\s+|warm\s+|low\s+|even\s+|raking\s+|diffused\s+|single\s+)*(?:key|side|top|rim|fill|raking)\s+light\b/gi,
    '',
  ],
  [
    /\s*,?\s*(?:under|in)\s+(?:a\s+)?(?:single\s+)?(?:soft|warm|low|even|raking|diffused)\s+light\b/gi,
    '',
  ],
  [/\s*,?\s*three-point[^,.]*/gi, ''],
  // The frame instruction, whole clause.
  [/\s*,?\s*reframed to[^,.]*/gi, ''],
  [/\s*,?\s*cropped to[^,.]*vertical[^,.]*/gi, ''],
  /*
   * "Backdrop" is a STUDIO WORD FOR A VISIBLE THING. The surface behind the subject is genuinely in
   * the picture and worth describing, so this rewrites rather than removes — "against a matte
   * obsidian background" tells a reader what they would see, which "backdrop" does not.
   */
  [/\bseamless backdrop\b/gi, 'background'],
  [/\bbackdrop\b/gi, 'background'],
  [/\bclose macro texture\b/gi, 'close-up of the texture'],

  /*
   * A HEX CODE IS A PALETTE INSTRUCTION and describes nothing to somebody who cannot see the image
   * — "deep midnight blue" does the same job in words. A minority of the prompts carry one inline,
   * usually parenthesised after a colour name, so the code goes and the name stays.
   */
  [/\s*\(?\s*#[0-9a-f]{3,8}\s*\)?/gi, ''],

  /*
   * THE STYLE PREAMBLE. A minority of the prompts open with rendering-style words — "Cinematic 4k
   * macro top-down view of …" — which are a request for a LOOK, not a description of a subject. The
   * subject follows them intact, so they come off the front and the sentence still reads.
   */
  [
    /^(?:cinematic|photorealistic|hyperrealistic|ultra-detailed|high detail|8k|4k|award-winning)[\s,]+/gi,
    '',
  ],
  [
    /\b(?:cinematic|photorealistic|hyperrealistic|ultra-detailed|high[- ]detail|8k|4k|award-winning)\b[\s,]*/gi,
    '',
  ],

  /*
   * A LIGHT THAT IS ACTUALLY VISIBLE KEEPS ITS PLACE. "The reflected key light stretched along the
   * polished band" describes a highlight somebody would see; only the rig's NAME is prompt
   * vocabulary. So the qualifier goes and the light stays, rather than deleting a real description
   * because of one word in it.
   */
  [/\b(?:key|rim|fill|raking)\s+light\b/gi, 'light'],
]

/**
 * One sentence describing what the picture shows.
 *
 * THE EM-DASH IS THE SEAM and it is present in all 250 prompts, so cutting there is a rule about
 * this corpus rather than a guess about prose in general. If a future prompt lacks one, the whole
 * prompt is treated as scene and the clause filter below does the work — which degrades to a longer
 * sentence, never to an instruction leaking through.
 */
function sceneOf(prompt: string): string {
  /*
   * NOT "EVERYTHING BEFORE THE FIRST EM-DASH". `WALL-ART-003` opens "A spare study — a plain desk,
   * one chair, a bare bookshelf — with one large resin panel…", where the first em-dash introduces
   * a PARENTHETICAL, and cutting there left the useless sentence "A spare study." The seam is the
   * em-dash whose following text OPENS with an instruction, so segments are kept until one does.
   */
  const segments = prompt.split(/\s+—\s+/)
  const kept: string[] = []
  for (const segment of segments) {
    if (INSTRUCTION_OPENER.test(segment.trim())) break
    kept.push(segment)
  }
  return kept.length === 0 ? (segments[0] ?? prompt) : kept.join(' — ')
}

function describe(asset: ManifestAsset): string {
  let text = sceneOf(asset.prompt)

  for (const [pattern, replacement] of INSTRUCTION_PHRASE) text = text.replace(pattern, replacement)

  const clauses = text
    .split(',')
    .map((clause) => clause.trim())
    .filter(
      (clause) => clause !== '' && !INSTRUCTION_CLAUSE.test(clause) && !CAMERA_CLAUSE.test(clause),
    )

  let out = clauses.join(', ').replace(/\s+/g, ' ').trim()

  /*
   * TRIMMED AT A CLAUSE BOUNDARY, NEVER AT A CHARACTER COUNT, and never with an ellipsis. Cutting
   * at a count is what produced the 124 broken drafts this script exists to replace; doing it again
   * with a different limit would be the same defect at a different length.
   */
  if (out.length > MAX) {
    const kept: string[] = []
    for (const clause of out.split(', ')) {
      const next = kept.length === 0 ? clause : `${kept.join(', ')}, ${clause}`
      if (next.length > MAX) break
      kept.push(clause)
    }
    out = kept.length > 0 ? kept.join(', ') : out.slice(0, MAX).replace(/\s+\S*$/, '')
  }

  /*
   * A TRAILING FRAGMENT AFTER A SEMICOLON IS A CUT, NOT A SENTENCE. `WALL-ART-003` trimmed to
   * "…unstyled room; walls" — grammatical up to the semicolon and nonsense after it. Dropping the
   * dangling half is the same principle as trimming at a clause boundary: finish where the meaning
   * finishes.
   */
  const semicolon = out.lastIndexOf(';')
  if (
    semicolon !== -1 &&
    out
      .slice(semicolon + 1)
      .trim()
      .split(/\s+/).length < 4
  ) {
    out = out.slice(0, semicolon)
  }

  /*
   * A FLOOR, because the clause filter can strip a short prompt down to nothing useful.
   * `WALL-ART-003` reduced to "A spare study" — grammatical, and it describes no picture. When that
   * happens the scene is kept whole rather than filtered, on the principle that too much
   * information is a worse failure than none but a far smaller one.
   */
  if (out.replace(/[.]$/, '').length < 25) {
    out = sceneOf(asset.prompt).replace(/\s+/g, ' ').trim()
    out = out.charAt(0).toUpperCase() + out.slice(1)
    if (!/[.!?]$/.test(out)) out += '.'
  }

  out = out.charAt(0).toUpperCase() + out.slice(1)
  if (!/[.!?]$/.test(out)) out += '.'
  return out
}

/**
 * What is already in the file, so a hand edit survives a regeneration.
 *
 * THIS IS WHAT MAKES THE FILE EDITABLE RATHER THAN GENERATED-AND-DISPOSABLE. An editor who improves
 * a sentence after looking at the picture has done the most valuable work in this phase, and a
 * generator that overwrote it on the next run would teach everybody to stop. `--overwrite` exists
 * for the one case where the derivation itself improved and the drafts should be rebuilt; it is not
 * the default, and it is not what CI runs.
 */
async function existingValues(): Promise<Record<string, string>> {
  if (!existsSync(OUT_PATH)) return {}
  try {
    // Named `loaded` rather than `module`: `module` is a reserved identifier in a Next.js
    // codebase (`@next/next/no-assign-module-variable`) even in a script the bundler never sees.
    const loaded: unknown = await import(`../../${OUT_PATH.replace(/\.ts$/, '')}`)
    const table = (loaded as { ALT_TEXT?: Record<string, string> }).ALT_TEXT
    return table ?? {}
  } catch {
    return {}
  }
}

const overwrite = process.argv.includes('--overwrite')
const manifest = readManifest()
const existing = await existingValues()

let kept = 0
const entries = manifest.assets.map((asset) => {
  const held = existing[asset.rivya_asset_id]
  if (!overwrite && typeof held === 'string' && held.trim() !== '') {
    kept += 1
    return { id: asset.rivya_asset_id, value: held }
  }
  return { id: asset.rivya_asset_id, value: describe(asset) }
})

const failing = entries.filter((entry) => altTextWarnings(entry.value).length > 0)

const body = [
  '/**',
  ' * THE TEXT ALTERNATIVE FOR EACH OF THE 250 MIGRATED ASSETS — Phase 43.',
  ' *',
  ' * GENERATED BY `npx tsx scripts/media/build-alt-text.ts`, AND EDITABLE BY HAND. The generator',
  ' * derives a first sentence from each prompt by keeping the scene and dropping the instructions;',
  ' * a person who has looked at the picture improves it, and the improvement is a reviewable diff',
  ' * in this file rather than an invisible change in a database.',
  ' *',
  ' * A PROMPT DESCRIBES WHAT WAS ASKED FOR. Only somebody looking at the image can say what',
  ' * arrived, so every value here stays `OWNER_VERIFICATION_REQUIRED` until an editor approves it',
  " * in the Studio's alt-text queue, which orders bound assets first.",
  ' *',
  ' * `npm run media:rewrite-alt-text` carries these values into `media_assets.alt_text`.',
  ' * `npm run media:check-alt-text` holds every value here to the SEED §43 rules.',
  ' */',
  '',
  'export const ALT_TEXT: Readonly<Record<string, string>> = {',
  ...entries.map((entry) => `  '${entry.id}': ${JSON.stringify(entry.value)},`),
  '}',
  '',
].join('\n')

/*
 * FORMATTED BEFORE IT IS WRITTEN, because `npm run check` runs `prettier --check .` over the
 * repository and a generated file that is always dirty makes the gate fail every time somebody
 * regenerates it — which teaches people to stop regenerating it. Prettier is already a
 * devDependency; using it here costs nothing and removes a permanent false failure.
 */
const formatted = await format(body, { ...(await resolveConfig(OUT_PATH)), parser: 'typescript' })
writeFileSync(OUT_PATH, formatted)

console.log(
  `✓ ${OUT_PATH}: ${String(entries.length)} value(s) (${String(kept)} kept from the file, ` +
    `${String(entries.length - kept)} derived)` +
    (failing.length > 0
      ? `; ${String(failing.length)} still fail the linter (${failing
          .slice(0, 5)
          .map((f) => f.id)
          .join(', ')})`
      : '; all clean against the SEED §43 rules'),
)
