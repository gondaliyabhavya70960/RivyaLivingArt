import type { SeedModule, SeedRecord } from './types'

/**
 * Phase 21: the words the 3D viewer speaks.
 *
 * EVERY LABEL A VISITOR CAN READ OR HEAR IS A ROW HERE, not a literal in `components/three/**`.
 * The control names are accessible names — a screen reader reads "Reset view" and nothing else —
 * so they are copy, and copy an owner cannot reword without a code change is the failure CLAUDE.md
 * names. The viewer refuses to mount without the essential ones (the control name, the canvas
 * name, the close and reset names): an unlabelled canvas with unlabelled buttons is not a viewer.
 *
 * NOTHING HERE DESCRIBES A PRODUCT. The preset names describe light, the notice describes the
 * model's provenance, the description describes the controls. A material name reaches the viewer
 * from `materials`, and only when the owner has verified the association (D10).
 */
function uiRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:UI_LABEL.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'UI_LABEL',
      key,
      label,
      value,
      description,
      is_enabled: true,
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}

export const modelViewerUiSeed: SeedModule = {
  name: 'model-viewer-ui',
  description:
    'Phase 21 3D viewer: the intent control, the canvas name and description, loading and failure states, every control name, the preset names and the concept notice.',
  records: [
    // --- the mount ------------------------------------------------------------------------------
    uiRow(
      'model.region',
      'Three-dimensional view',
      '3D viewer — region name',
      'Names the region that holds the poster and the viewer, for a screen reader. Rendered visually hidden.',
    ),
    uiRow(
      'model.inspect',
      'Inspect in 3D',
      '3D viewer — the control that loads it',
      'The button on the poster. Nothing three-dimensional is downloaded until it is pressed (or, on a wide screen with motion allowed, until the poster scrolls into view). Without this row the poster renders alone.',
    ),
    uiRow(
      'model.viewer.name',
      '{{title}} in 3D',
      '3D viewer — canvas name',
      'The accessible name of the canvas. {{title}} is the product, project or section title.',
    ),
    uiRow(
      'model.viewer.description',
      'An interactive view you can turn and zoom. Drag to orbit; scroll or pinch to zoom; right-drag or two-finger drag to pan. On a keyboard: arrow keys orbit, Shift with arrows pans, plus and minus zoom, R resets the view, F toggles fullscreen, M inspects the finish, D shows the dimensions, Escape leaves fullscreen.',
      '3D viewer — canvas description',
      'Read once by a screen reader as the description of the canvas. It lists every control route so a keyboard user knows the keys exist.',
    ),
    uiRow(
      'model.loading',
      'Loading model, {{percent}}%',
      '3D viewer — loading progress',
      'Announced politely at 0, 50 and 100 percent while the model downloads. {{percent}} is the number.',
    ),
    uiRow(
      'model.failed',
      'The 3D view could not be loaded. The photograph remains.',
      '3D viewer — load failure',
      'Shown over the poster when the model or the engine fails to load. The poster stays; nothing else changes.',
    ),
    uiRow(
      'model.concept_notice',
      'Concept model — not a photograph of a delivered piece.',
      '3D viewer — concept notice',
      'Shown in the viewer chrome whenever the model is marked is_concept. A rendering must never read as a record of finished work.',
    ),
    // --- controls -------------------------------------------------------------------------------
    uiRow(
      'model.reset',
      'Reset view',
      '3D viewer — reset control',
      'Returns the camera to its starting position. Keyboard: R.',
    ),
    uiRow('model.fullscreen', 'Fullscreen', '3D viewer — fullscreen control', 'Keyboard: F.'),
    uiRow(
      'model.exit_fullscreen',
      'Exit fullscreen',
      '3D viewer — exit fullscreen control',
      'Keyboard: F again, or Escape.',
    ),
    uiRow(
      'model.close',
      'Close 3D view',
      '3D viewer — close control',
      'Returns to the poster and releases the engine.',
    ),
    uiRow(
      'model.material.toggle',
      'Inspect finish',
      '3D viewer — material inspection toggle',
      'Moves the camera close and names the finish being shown. Keyboard: M.',
    ),
    uiRow(
      'model.material.heading',
      'Finish',
      '3D viewer — material panel heading',
      'Heads the panel that names the active finish. A material name appears only when the owner has verified it.',
    ),
    uiRow(
      'model.variants',
      'Finish options',
      '3D viewer — variant switcher name',
      'The accessible name of the tab list that switches between the finishes the model carries. Absent when the model has one finish.',
    ),
    uiRow(
      'model.dimensions.toggle',
      'Show dimensions',
      '3D viewer — dimensions toggle',
      'Shows the owner-entered measurements beside the model. Absent when the product has none. Keyboard: D.',
    ),
    uiRow(
      'model.dimensions.heading',
      'Dimensions',
      '3D viewer — dimensions panel heading',
      'Heads the measurements panel. The values are products.dimensions, never anything read from the model.',
    ),
    uiRow(
      'model.lighting',
      'Lighting',
      '3D viewer — lighting select label',
      'Labels the lighting preset select.',
    ),
    uiRow(
      'model.environment',
      'Environment',
      '3D viewer — environment select label',
      'Labels the environment preset select.',
    ),
    // --- preset names -----------------------------------------------------------------------------
    uiRow(
      'model.lighting.studio_soft',
      'Studio, soft',
      '3D viewer — lighting preset',
      'Even, shadowless light from all sides.',
    ),
    uiRow(
      'model.lighting.gallery_directional',
      'Gallery, directional',
      '3D viewer — lighting preset',
      'One strong light from above and the side, as in an exhibition.',
    ),
    uiRow(
      'model.lighting.daylight_window',
      'Daylight from a window',
      '3D viewer — lighting preset',
      'Cool, broad light from one side.',
    ),
    uiRow(
      'model.lighting.low_key',
      'Low key',
      '3D viewer — lighting preset',
      'Dim surroundings, one warm light.',
    ),
    uiRow(
      'model.environment.neutral_room',
      'Neutral room',
      '3D viewer — environment preset',
      'A pale ground and a light backdrop.',
    ),
    uiRow(
      'model.environment.dark_gallery',
      'Dark gallery',
      '3D viewer — environment preset',
      'The obsidian ground of the site, for a piece that reads best against dark.',
    ),
    uiRow(
      'model.environment.warm_interior',
      'Warm interior',
      '3D viewer — environment preset',
      'A champagne-toned room.',
    ),
  ],
}
