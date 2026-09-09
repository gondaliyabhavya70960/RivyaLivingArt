import type { SeedModule, SeedRecord } from './types'

/**
 * The words `/product/[slug]` uses: the gallery's names, the specification labels, the material
 * band's caption and the two related-content headings.
 *
 * WHY A MODULE OF ITS OWN. Same reason `catalog-ui.ts` exists, given at length in its header: none
 * of these sentences is quoted from the SEED specification, all of them describe an interface, and
 * a reader should be able to tell at a glance which strings a component invented. Back-filling them
 * into `global.ts` would blur that line permanently.
 *
 * THE DIMENSION LABELS ARE THE INTERESTING ONES. `products.dimensions` stores `length_mm`, and the
 * key carries its unit so nothing has to infer or convert one — but `length_mm` is an internal
 * identifier and a visitor must never be shown one. These rows are how a key becomes a word, and
 * how an owner renames "Length" to "Table length" without a code change. `ProductSpecifications`
 * DROPS a measurement whose label row is missing rather than falling back to the key.
 *
 * `UI_LABEL`, NOT A NEW GROUP. `global_content_group_allowed` fixes the vocabulary at fourteen
 * groups precisely so it does not grow one surface at a time, and every row here names a control or
 * a field rather than asserting anything about the business.
 *
 * TWO ROWS CARRY TOKENS, AND BOTH ARE SENTENCES RATHER THAN GLUED FRAGMENTS. "{{position}} of
 * {{total}}" and "More in {{category}}" exist as whole strings for the reason SEED gives about the
 * pagination position: a sentence assembled in JSX from three nodes cannot be translated, reordered
 * or reworded by an editor, and both of these are read aloud.
 *
 * EVERY ROW IS EDITORIAL_COPY / NOT_REQUIRED AND SEEDS PUBLISHED. A gallery whose strip has no
 * accessible name is worse than one with a plain name, and gating interface words behind owner
 * verification would leave the page unusable while telling the owner nothing they could act on. The
 * material band's caption is the one to look at twice — it describes what the images ARE rather
 * than making a claim about the piece, which is why it is editorial rather than a business fact.
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

export const productDetailUiSeed: SeedModule = {
  name: 'product-detail-ui',
  description:
    'Phase 15 product page: gallery names, specification and dimension labels, the material band caption and the two related headings.',
  records: [
    // --- the gallery -----------------------------------------------------------------------------
    uiRow(
      'product.gallery.heading',
      'Gallery',
      'Product gallery — region name',
      'Names the gallery region for a screen reader. Rendered visually hidden: the images are the heading.',
    ),
    uiRow(
      'product.gallery.thumbnails',
      'Gallery thumbnails',
      'Product gallery — thumbnail strip name',
      'The accessible name of the thumbnail list. Without it the strip is announced as a wall of graphics with no indication of what it is for, so the strip does not render at all when this row is missing.',
    ),
    uiRow(
      'product.gallery.lightbox',
      'Enlarged view',
      'Product gallery — lightbox name',
      'The dialog title when an image is opened full size. The lightbox does not open without it, because an unlabelled modal is unreachable by name.',
    ),
    uiRow(
      'product.gallery.position',
      '{{position}} of {{total}}',
      'Product gallery — position in the sequence',
      'Announced politely as the lightbox moves between images. A whole sentence rather than three nodes glued together in JSX, so it can be reworded or reordered without a code change.',
    ),

    // --- the specification block -----------------------------------------------------------------
    uiRow(
      'product.specifications.heading',
      'Specifications',
      'Product page — specification block heading',
      'Heads the table of owner-entered facts. The block is absent entirely when the product has none, so this is never a heading over nothing.',
    ),

    // The seven measurement labels. The unit lives in the key and is appended by the renderer;
    // nothing here states it, so an owner renaming a label cannot accidentally change a unit.
    uiRow(
      'product.dimension.length_mm',
      'Length',
      'Dimension label — length',
      'Names products.dimensions.length_mm. The value is shown in millimetres, as entered; nothing converts it.',
    ),
    uiRow(
      'product.dimension.width_mm',
      'Width',
      'Dimension label — width',
      'Names products.dimensions.width_mm, in millimetres as entered.',
    ),
    uiRow(
      'product.dimension.height_mm',
      'Height',
      'Dimension label — height',
      'Names products.dimensions.height_mm, in millimetres as entered.',
    ),
    uiRow(
      'product.dimension.depth_mm',
      'Depth',
      'Dimension label — depth',
      'Names products.dimensions.depth_mm, in millimetres as entered.',
    ),
    uiRow(
      'product.dimension.diameter_mm',
      'Diameter',
      'Dimension label — diameter',
      'Names products.dimensions.diameter_mm, in millimetres as entered. Only meaningful for a round piece, and absent on every other.',
    ),
    uiRow(
      'product.dimension.weight_g',
      'Weight',
      'Dimension label — weight',
      'Names products.dimensions.weight_g. Shown in grams, as entered; nothing converts it to kilograms.',
    ),
    uiRow(
      'product.dimension.seats',
      'Seats',
      'Dimension label — seat count',
      'Names products.dimensions.seats. A count rather than a measurement, so it renders as a bare number with no unit.',
    ),

    // --- the material band -----------------------------------------------------------------------
    uiRow(
      'product.materials.heading',
      'Materials',
      'Product page — material band heading',
      'Heads the material studies. Absent entirely when the owner has attached no materials.',
    ),
    uiRow(
      'product.materials.caption',
      'These images show the materials this piece is made from, not the piece itself.',
      'Product page — material band caption',
      'The sentence that keeps a material study from being read as a photograph of the product. It is the one place a concept render may appear on this route (D6, D10), and the band does not render without this row.',
    ),

    // --- related content --------------------------------------------------------------------------
    uiRow(
      'product.related.curated',
      'Related',
      'Product page — curated relations heading',
      'Used ONLY for relations an editor created by hand in product_relations. Never for the automatic same-category set, which has its own heading and its own key.',
    ),
    uiRow(
      'product.related.same_category',
      'More in {{category}}',
      'Product page — same-category fallback heading',
      'Used when a product has no manual relations. It states a fact — these pieces share a category — rather than implying a judgement nobody made, which is why it is deliberately not "Related" or "You may also like".',
    ),
  ],
}
