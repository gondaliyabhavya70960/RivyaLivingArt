import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { siteString, type SiteStrings } from '@/lib/cms/strings'
import type { Material, MediaAsset } from '@/lib/supabase/schemas'

/**
 * The material band — the one place on a product page where a concept render legitimately appears.
 *
 * WHY THAT IS NOT A CONTRADICTION. The 0122 trigger refuses a concept asset on `product_media` and
 * on `products.hero_media_id`, because a concept render sitting on a product card stops being an
 * illustration and becomes a photograph of an object that does not exist. A concept render attached
 * to a MATERIAL is a different claim: it shows what resin looks like, not what this table looks
 * like. So the imagery here comes from the `materials` row, is captioned as a material study, and
 * sits in its own labelled band below the specification block — three separate signals that a
 * visitor is looking at the material rather than the piece.
 *
 * THE CAPTIONS COME FROM THE MATERIAL, NEVER THE PRODUCT. `materials.description` is
 * `EDITORIAL_COPY` about the material itself. Rendering the product's words beside a material study
 * is how a band like this quietly turns into a claim about what this particular piece is made of,
 * beyond what the owner attached.
 *
 * NO MATERIALS ATTACHED MEANS NO BAND AT ALL — not an empty heading, not "materials to be
 * confirmed". A product whose materials the owner has not recorded is a product about whose
 * materials this page says nothing.
 */

export interface ProductMaterialStoryProps {
  /** The materials attached to this product, already resolved and ordered. */
  readonly materials: readonly Material[]
  /** One image per material id, where the owner has attached one. Absent is fine. */
  readonly imagery: ReadonlyMap<string, MediaAsset>
  readonly strings: SiteStrings
  /** Null when NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is unset — the band then renders without imagery. */
  readonly cloudName: string | null
  readonly headingLevel?: 2 | 3
}

export function ProductMaterialStory({
  materials,
  imagery,
  strings,
  cloudName,
  headingLevel = 2,
}: ProductMaterialStoryProps): React.ReactElement | null {
  if (materials.length === 0) return null

  const heading = siteString(strings, 'UI_LABEL.product.materials.heading')
  // The band must announce itself as a material study. Without that sentence the images read as
  // photographs of this piece, which is the exact misreading the band is arranged to prevent — so
  // no caption means no band, rather than a band that misleads.
  const caption = siteString(strings, 'UI_LABEL.product.materials.caption')
  if (caption === null) return null

  return (
    <section data-material-band="">
      <Stack gap={6}>
        {heading === null ? null : <Heading level={headingLevel}>{heading}</Heading>}

        <Text size="sm" tone="secondary" data-material-band-caption="">
          {caption}
        </Text>

        <Stack gap={8}>
          {materials.map((material) => {
            const asset = imagery.get(material.id) ?? null
            return (
              <article key={material.id} data-material-study={material.family}>
                <Stack gap={3}>
                  {asset === null || cloudName === null ? null : (
                    // 4:3 for every study, so a band of them reads as one series rather than a
                    // ragged column — these are material samples, not compositions.
                    <BlockImage
                      asset={asset}
                      ratio="4:3"
                      preset="card"
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      strings={strings}
                      cloudName={cloudName}
                    />
                  )}
                  <Heading level={headingLevel === 2 ? 3 : 4}>{material.name}</Heading>
                  {/* The family is a taxonomy value the owner chose, not a sentence about the piece. */}
                  <Text as="span" size="sm" tone="secondary" data-material-family="">
                    {material.family}
                  </Text>
                  {material.description === null || material.description.trim() === '' ? null : (
                    <Text>{material.description}</Text>
                  )}
                </Stack>
              </article>
            )
          })}
        </Stack>
      </Stack>
    </section>
  )
}
