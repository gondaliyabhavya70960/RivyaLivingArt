import type { EnvironmentPresetKey, LightingPresetKey } from '@/lib/media/viewer-settings'

/**
 * Lighting and environment presets, as data.
 *
 * EVERY COLOUR IS A PHASE 02 TOKEN, AND ONLY A TOKEN. A preset names `--rv-color-bone` and never a
 * hex value; the viewer resolves the token from the document at mount (`resolveTokenColour`) so a
 * palette change in `tokens.css` reaches the canvas without an edit here. There is no fallback
 * colour in this file: `design:check-tokens` forbids a colour literal outside `app/styles/`, and a
 * fallback would also hide a mistyped token behind a plausible colour. A token the document does
 * not carry resolves to null, the canvas falls back to three's own default (white), and the
 * mistake is visible rather than approximated. `tests/unit/model-policy.test.ts` asserts every
 * token named here is declared in tokens.css.
 *
 * NO HDR, NO IMAGE-BASED LIGHTING, NO FETCH. An environment map is a download the FEAT §14 budget
 * did not allow for and an origin the viewer must not need. Three or four analytic lights and a
 * ground disc in a palette colour are what an object needs to read as an object.
 *
 * NO PRESET IS A MATERIAL CLAIM. "Daylight from a window" describes light; it says nothing about
 * how the finish would look in a room, and the viewer never says it does.
 */

export type TokenColour = {
  /** A `--rv-*` custom property name, declared in `app/styles/tokens.css`. */
  readonly token: string
}

export type LightSpec =
  | { readonly kind: 'ambient'; readonly colour: TokenColour; readonly intensity: number }
  | {
      readonly kind: 'hemisphere'
      readonly sky: TokenColour
      readonly ground: TokenColour
      readonly intensity: number
    }
  | {
      readonly kind: 'directional'
      readonly colour: TokenColour
      readonly intensity: number
      /** Direction from the target, in model radii; the rig scales it to the loaded bounds. */
      readonly position: readonly [number, number, number]
    }

export type LightingPreset = {
  readonly key: LightingPresetKey
  readonly lights: readonly LightSpec[]
  /** Multiplies `viewer_settings.exposure`. Low-key is dim by design, not by accident. */
  readonly exposure: number
}

export type EnvironmentPreset = {
  readonly key: EnvironmentPresetKey
  readonly background: TokenColour
  readonly ground: TokenColour
  /** Blend the background toward a second token, 0–1. How "warm interior" is warm. */
  readonly tint: { readonly colour: TokenColour; readonly amount: number } | null
  /** Fog, in model radii from the target; null for none. */
  readonly fog: { readonly near: number; readonly far: number } | null
}

const OBSIDIAN: TokenColour = { token: '--rv-color-obsidian' }
const OBSIDIAN_RAISED: TokenColour = { token: '--rv-color-obsidian-raised' }
const BONE: TokenColour = { token: '--rv-color-bone' }
const BONE_SUNKEN: TokenColour = { token: '--rv-color-bone-sunken' }
const NEUTRAL_100: TokenColour = { token: '--rv-neutral-100' }
const NEUTRAL_300: TokenColour = { token: '--rv-neutral-300' }
const STEEL: TokenColour = { token: '--rv-color-steel' }
const CHAMPAGNE: TokenColour = { token: '--rv-color-champagne' }
const CHAMPAGNE_DEEP: TokenColour = { token: '--rv-color-champagne-deep' }
const GOLD_BRIGHT: TokenColour = { token: '--rv-color-gold-bright' }

export const LIGHTING_PRESETS: Readonly<Record<LightingPresetKey, LightingPreset>> = {
  'studio-soft': {
    key: 'studio-soft',
    exposure: 1,
    lights: [
      { kind: 'hemisphere', sky: BONE, ground: NEUTRAL_300, intensity: 1.2 },
      { kind: 'directional', colour: BONE, intensity: 1.6, position: [3, 5, 4] },
      { kind: 'directional', colour: BONE, intensity: 0.6, position: [-4, 2, -2] },
    ],
  },
  'gallery-directional': {
    key: 'gallery-directional',
    exposure: 1,
    lights: [
      { kind: 'ambient', colour: NEUTRAL_300, intensity: 0.25 },
      { kind: 'directional', colour: BONE, intensity: 3, position: [2, 6, 1] },
      { kind: 'directional', colour: STEEL, intensity: 0.3, position: [-3, 1, -3] },
    ],
  },
  'daylight-window': {
    key: 'daylight-window',
    exposure: 1.05,
    lights: [
      { kind: 'hemisphere', sky: BONE, ground: BONE_SUNKEN, intensity: 0.9 },
      { kind: 'directional', colour: BONE, intensity: 2.4, position: [-6, 4, 2] },
      { kind: 'directional', colour: STEEL, intensity: 0.4, position: [5, 1, -3] },
    ],
  },
  'low-key': {
    key: 'low-key',
    exposure: 0.85,
    lights: [
      { kind: 'ambient', colour: OBSIDIAN_RAISED, intensity: 0.4 },
      { kind: 'directional', colour: CHAMPAGNE, intensity: 2.2, position: [2, 3, -1] },
      { kind: 'directional', colour: GOLD_BRIGHT, intensity: 0.5, position: [-2, 1, 2] },
    ],
  },
}

export const ENVIRONMENT_PRESETS: Readonly<Record<EnvironmentPresetKey, EnvironmentPreset>> = {
  'neutral-room': {
    key: 'neutral-room',
    background: BONE_SUNKEN,
    ground: NEUTRAL_100,
    tint: null,
    fog: null,
  },
  'dark-gallery': {
    key: 'dark-gallery',
    background: OBSIDIAN,
    ground: OBSIDIAN_RAISED,
    tint: null,
    fog: { near: 5, far: 14 },
  },
  'warm-interior': {
    key: 'warm-interior',
    background: BONE,
    ground: NEUTRAL_100,
    tint: { colour: CHAMPAGNE_DEEP, amount: 0.22 },
    fog: null,
  },
}

/** Every token a preset names, for the test that checks them against tokens.css. */
export function presetTokens(): readonly TokenColour[] {
  const out = new Map<string, TokenColour>()
  const add = (c: TokenColour): void => {
    out.set(c.token, c)
  }
  for (const preset of Object.values(LIGHTING_PRESETS)) {
    for (const light of preset.lights) {
      if (light.kind === 'hemisphere') {
        add(light.sky)
        add(light.ground)
      } else {
        add(light.colour)
      }
    }
  }
  for (const preset of Object.values(ENVIRONMENT_PRESETS)) {
    add(preset.background)
    add(preset.ground)
    if (preset.tint !== null) add(preset.tint.colour)
  }
  return [...out.values()]
}

/**
 * The token's live value, or null. Read from the root element so a scheme class on an ancestor
 * cannot change what a preset means: the presets name PRIMITIVE tokens, which are declared once
 * on `:root` and never redeclared by a scheme.
 *
 * NULL, NOT A GUESS. With no document (the unit suite) or a token the document does not declare,
 * there is no honest colour to return; the canvas passes null through to three, whose default is
 * white, so a missing token shows as a white light or a white background rather than as a
 * near-miss nobody notices.
 */
export function resolveTokenColour(colour: TokenColour): string | null {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return null
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(colour.token).trim()
  return value === '' ? null : value
}
