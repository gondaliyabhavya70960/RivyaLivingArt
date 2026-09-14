/**
 * IS THIS ALT TEXT, OR IS IT LEFTOVER PROMPT? — Phase 41.
 *
 * 250 manifest assets carry an `alt_text` that satisfies every constraint the database can express
 * and fails WCAG 1.1.1 in spirit. 124 of them are truncated mid-sentence; the remaining 126 are
 * complete sentences carrying the vocabulary of the prompt that generated the picture — reframing
 * instructions, lighting direction, backdrop notes, lens language.
 *
 * A CONSTRAINT CANNOT CATCH THIS AND A HUMAN READING 250 ROWS WILL MISS SOME. So the smell is
 * written down as rules, and the Studio panel shows the warning beside the field while somebody is
 * editing it. It is ADVICE, NEVER A REFUSAL: the judgement about whether a sentence describes the
 * picture is a person's, and a validator confident enough to block would eventually block a correct
 * description that happened to mention light.
 *
 * IT IS A PURE FUNCTION so the same rules drive the Studio warning, `scripts/media/check-alt-text.mjs`
 * (Phase 43) and `tests/unit/alt-text-coverage.test.ts`. Three places agreeing about what bad alt
 * text looks like is the only way the rewrite in Phase 43 can be checked at all.
 */

export type AltTextWarning =
  | 'TRUNCATED'
  | 'PROMPT_VOCABULARY'
  | 'REDUNDANT_PREFIX'
  | 'TOO_SHORT'
  | 'PROMPT_DIRECTION'
  | 'CLAIMS_CAPTURE'
  | 'MALFORMED'

/**
 * Words that belong to the making of a picture rather than to the picture.
 *
 * THE TEST FOR THIS LIST IS "WOULD A PERSON WHO CANNOT SEE THE IMAGE BE HELPED BY THIS WORD". "Warm
 * afternoon light" describes the scene and is fine; "three-point lighting" describes the rig. "Seen
 * from above" is a description; "camera angle" is a direction to a camera.
 */
const PROMPT_VOCABULARY = [
  'shot on',
  'shot with',
  'camera angle',
  'focal length',
  'depth of field',
  'bokeh',
  'three-point',
  'key light',
  'rim light',
  'fill light',
  'softbox',
  'backdrop',
  'seamless background',
  'studio lighting',
  'photorealistic',
  'hyperrealistic',
  'ultra-detailed',
  'high detail',
  '8k',
  '4k',
  'render of',
  'rendering of',
  'cinematic',
  'award-winning',
  'trending on',
  'aspect ratio',
  'negative prompt',
  'mm lens',
  'f/1',
  'f/2',
  'iso ',
]

/**
 * Instructions to the GENERATOR that survived the rewrite — Phase 44.
 *
 * `PROMPT_VOCABULARY` above catches the language of a camera. This catches the language of a BRIEF:
 * the safe area a headline was going to sit in, the continuity note telling the generator to keep
 * the previous frame's palette, the negative prompt, the house style tag, the variant label. None
 * of it is a camera word, so none of it was caught — and 45 values shipped saying things like
 * "the upper third of the frame calm and near-empty as headline safe area. Quiet luxury, materials
 * never plastic, realistic proportions., no neon, no heavy gold", which describes the picture not
 * at all. That value was bound to the live `/large-format` mobile hero.
 *
 * THE TEST IS THE SAME AS ABOVE: would a person who cannot see the image be helped by this phrase.
 * "Calm dark lower third" is a description of the picture. "Calm dark lower third suitable for
 * quiet text overlay" is a note to whoever was going to set type on it.
 */
const PROMPT_DIRECTIONS = [
  'safe area',
  'text overlay',
  'quiet luxury',
  'never plastic',
  'materials never',
  'realistic proportions',
  'no neon',
  'no heavy gold',
  'no people, no text',
  'horizontal master',
  'not a new scene',
  'keeping the same subject',
  'keeping the same palette',
  'reads as the same',
  'must read as the same',
  'reframed to',
  'reframed for',
  'loopable',
  'variant)',
  'variant 2',
  '720p',
  '1080p',
  'composed as a social',
  'for social:',
  'for a mobile hero',
  'handcrafted resin art.',
]

/**
 * A CLAIM THAT THE PICTURE IS A PHOTOGRAPH, which on this project is never true.
 *
 * All 250 catalogued assets are `is_concept` and `is_ai_generated` — there is not one photograph of
 * a delivered Rivya piece among them. So an alternative that opens "Editorial photograph:" or ends
 * "luxury product photography" is not merely prompt residue, it is the exact claim CLAUDE.md's
 * media rule and the public brief both forbid: concept media presented as a record of something
 * that was made and delivered. Two of these were live — the `/large-format` hero and the homepage.
 *
 * PHRASES, NOT THE BARE WORD. "A figurine on a turntable beside reference photos" describes objects
 * sitting in the scene and is correct; the rule must not punish it. What is caught is the text
 * describing its own medium.
 */
const CAPTURE_CLAIMS = [
  'photograph:',
  'photograph,',
  'photograph.',
  'photograph of',
  'photographed',
  'photographic',
  'photography',
  'editorial photograph',
  'macro photograph',
]

/** An alt text that begins by saying it is an image wastes the words a screen reader announces. */
const REDUNDANT_PREFIX =
  /^\s*(?:an?\s+)?(?:image|picture|photo|photograph|graphic|icon)\s+(?:of|showing|depicting)\b/i

/**
 * Every problem this text has. Empty means nothing was found — which is not the same as "this is
 * good", and the Studio copy says so.
 */
export function altTextWarnings(value: string): AltTextWarning[] {
  const text = value.trim()
  const warnings: AltTextWarning[] = []

  /*
   * TRUNCATION, BY THE CHARACTER RATHER THAN BY THREE DOTS. Every truncated value in the manifest
   * ends in `…` — the single ellipsis character — because that is what the importer wrote. Checking
   * for `...` as well costs nothing and catches a hand-typed one.
   */
  if (/[…]\s*$/.test(text) || /\.\.\.\s*$/.test(text)) warnings.push('TRUNCATED')

  const lower = text.toLowerCase()
  if (PROMPT_VOCABULARY.some((phrase) => lower.includes(phrase))) {
    warnings.push('PROMPT_VOCABULARY')
  }

  if (PROMPT_DIRECTIONS.some((phrase) => lower.includes(phrase))) {
    warnings.push('PROMPT_DIRECTION')
  }

  if (CAPTURE_CLAIMS.some((phrase) => lower.includes(phrase))) warnings.push('CLAIMS_CAPTURE')

  /*
   * PUNCTUATION THE REWRITE BROKE. Dropping a trailing clause by hand leaves "upper third calm..",
   * and dropping a leading one leaves "Vertical : a large live-edge table". Neither trips any rule
   * about vocabulary, and both are read aloud. `...` is deliberately excluded — an ellipsis is
   * TRUNCATED's finding, and reporting one defect twice helps nobody.
   */
  if (/[^.]\.\.(?!\.)/.test(text) || /\s:/.test(text) || /\.\s*,|,\s*\./.test(text)) {
    warnings.push('MALFORMED')
  }

  if (REDUNDANT_PREFIX.test(text)) warnings.push('REDUNDANT_PREFIX')

  /*
   * A FLOOR OF FIFTEEN CHARACTERS, not of words. "Teak console" is a label rather than a
   * description and is about the shortest thing that ever appears; anything under this is a file
   * name or a placeholder. It is deliberately low — the point is to catch an empty gesture, not to
   * demand a paragraph.
   */
  if (text.length > 0 && text.length < 15) warnings.push('TOO_SHORT')

  return warnings
}

/** True when this value would be worth a person's attention. */
export function needsAltTextReview(value: string): boolean {
  return altTextWarnings(value).length > 0
}
