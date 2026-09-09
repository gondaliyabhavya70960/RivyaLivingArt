import type { Route } from 'next'
import Link from 'next/link'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ProductForm } from '@/components/studio/catalog/ProductForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'

import { saveProductAction } from '../../actions'
import { blankProductValues } from '../../product-values'
import { productFormOptions } from '../../product-page-data'

/**
 * /studio/catalog/products/new — the only way a product comes into existence.
 *
 * SEED §32 AND D10 MEET HERE. Nothing seeds a product, nothing imports one, and no fixture creates
 * one; a product exists because a person typed it into this form. That is why the page is gated on
 * `catalog.write` rather than `catalog.read` — a viewer has no business on a screen whose only
 * purpose is to create inventory.
 */
export const metadata = { title: 'New product — Rivya Studio' }

export default async function Page() {
  await requirePermission('catalog.write')
  const options = await productFormOptions()

  return (
    <Stack gap={6}>
      <PageHeader level={1} title={t('studio.catalog.products.newHeading')} />
      <Link href={'/studio/catalog/products' as Route} className="underline underline-offset-4">
        <Text size="sm" as="span">
          {t('studio.catalog.products.caption')}
        </Text>
      </Link>
      <ProductForm
        values={blankProductValues()}
        categories={options.categories}
        materials={options.materials}
        mediaOptions={options.mediaOptions}
        action={saveProductAction}
        canWrite
      />
    </Stack>
  )
}
