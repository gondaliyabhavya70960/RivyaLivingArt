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

export type AltTextWarning = 'TRUNCATED' | 'PROMPT_VOCABULARY' | 'REDUNDANT_PREFIX' | 'TOO_SHORT'

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
