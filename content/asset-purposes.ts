/**
 * What each Higgsfield family is FOR — the controlled vocabulary of
 * `docs/media/HIGGSFIELD_ASSET_STATUS.md` §2.1, in code.
 *
 * WHY IT IS HERE AND NOT IN THE MANIFEST. The manifest is read-only input produced by
 * `build-higgsfield-manifest.py` from Higgsfield's own generation history; it records what was
 * generated, and nothing in that history knows what Rivya intends an asset for. Purpose is an
 * editorial judgement about the library, so it is declared alongside the slot registry — the
 * other file in `content/` that states an intention rather than a fact.
 *
 * ONE MAP, TWO CONSUMERS. The Studio's Inventory tab renders it and
 * `scripts/media/build-asset-status.ts` writes it into the status document. Before this existed
 * they were separate lists, which is a drift waiting to happen: the day a family is renamed, a
 * table in a document and a column in the Studio would disagree and neither would be wrong
 * enough to notice. `tests/unit/media-inventory.test.ts` asserts the map covers all 24 families
 * exactly — no family unlabelled, no label for a family that does not exist.
 */
export type AssetPurpose =
  | 'MATERIAL_STORY'
  | 'PROCESS_STORY'
  | 'CATEGORY_GALLERY'
  | 'LARGE_FORMAT_SUBJECT'
  | 'INTERIOR_CONTEXT'
  | 'EXHIBITION_ATMOSPHERE'
  | 'EDITORIAL_COVER'

export const ASSET_PURPOSE_BY_FAMILY: Readonly<Record<string, AssetPurpose>> = {
  'material-macro': 'MATERIAL_STORY',

  'process-cure': 'PROCESS_STORY',
  'process-finish': 'PROCESS_STORY',
  'process-mould': 'PROCESS_STORY',
  'process-pigment': 'PROCESS_STORY',
  'process-pour': 'PROCESS_STORY',
  'process-studio': 'PROCESS_STORY',
  'process-timber': 'PROCESS_STORY',

  decor: 'CATEGORY_GALLERY',
  gifts: 'CATEGORY_GALLERY',
  'three-d-resin': 'CATEGORY_GALLERY',
  'wall-art': 'CATEGORY_GALLERY',
  'preservation-keepsake': 'CATEGORY_GALLERY',
  'preservation-varmala': 'CATEGORY_GALLERY',

  'largeformat-coffee': 'LARGE_FORMAT_SUBJECT',
  'largeformat-console': 'LARGE_FORMAT_SUBJECT',
  'largeformat-dining': 'LARGE_FORMAT_SUBJECT',
  'largeformat-monumental': 'LARGE_FORMAT_SUBJECT',
  'largeformat-seating': 'LARGE_FORMAT_SUBJECT',
  'largeformat-side': 'LARGE_FORMAT_SUBJECT',

  'interior-lifestyle': 'INTERIOR_CONTEXT',

  /**
   * NOT `PORTFOLIO_PROJECT`, and the distinction is load-bearing rather than pedantic. These five
   * are rooms with work in them — atmosphere. Labelling them as project media would make them
   * candidates for a portfolio entry, which asserts that Rivya delivered a piece to a client
   * (D10). `/portfolio` keeps its empty state; these fill exhibition and gallery surfaces.
   */
  'gallery-scene': 'EXHIBITION_ATMOSPHERE',

  editorial: 'EDITORIAL_COVER',
  'workshop-session': 'EDITORIAL_COVER',
}

/**
 * An unmapped family is a defect, not a default. Returning a placeholder would let a manifest
 * rebuild introduce a family that silently renders as "unknown" in the Studio and in the status
 * document; the unit test asserts this never returns null for a real family.
 */
export function purposeFor(family: string): AssetPurpose | null {
  return ASSET_PURPOSE_BY_FAMILY[family] ?? null
}
