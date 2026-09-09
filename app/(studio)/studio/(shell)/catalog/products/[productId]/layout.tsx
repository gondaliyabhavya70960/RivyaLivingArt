import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ProductTabs } from '@/components/studio/catalog/ProductTabs'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { NotFoundError } from '@/lib/supabase/errors'
import { getProductById } from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'

/**
 * The frame every product tab shares: who this product is, and how to reach its other sections.
 *
 * A LAYOUT RATHER THAN FIVE COPIES OF A HEADER. Next keeps a layout mounted while the pages beneath
 * it change, so the title, the status pill and the tab strip do not re-render — and, more usefully,
 * cannot disagree between tabs, which is what five hand-maintained headers eventually do.
 *
 * TABS ARE LINKS, NOT STATE. Each section is its own URL, so an editor can bookmark the
 * specification table of a particular piece, open two products' Media tabs side by side, and use
 * the back button as a back button. A client `Tabs` component holding the active pane in state
 * would render one address for five different screens and lose all three.
 *
 * IT RE-READS THE PRODUCT, and that is a deliberate second query rather than an oversight. The
 * alternative is threading the row down through `children`, which a layout cannot do. What it buys
 * is that `notFound()` happens once, here, for every tab: a product this role cannot see is a 404
 * on `/media` exactly as it is on the overview, with no tab left rendering a header for a row it
 * could not load.
 */

/**
 * The five sections, in the order an editor works through them.
 *
 * `segment` is what `useSelectedLayoutSegment` reports for each child, so `null` is the index page
 * rather than an empty string — the hook's own vocabulary, not a path fragment.
 */
const TABS = [
  { segment: null, key: 'studio.catalog.product.tabs.overview' },
  { segment: 'media', key: 'studio.catalog.product.tabs.media' },
  { segment: 'materials', key: 'studio.catalog.product.tabs.materials' },
  { segment: 'specifications', key: 'studio.catalog.product.tabs.specifications' },
  { segment: 'related', key: 'studio.catalog.product.tabs.related' },
] as const

export default async function Layout({
  children,
  params,
}: {
  readonly children: React.ReactNode
  readonly params: Promise<{ productId: string }>
}) {
  await requirePermission('catalog.read')
  const { productId } = await params

  const client = await createClient()
  const product = await getProductById(client, productId).catch((error: unknown) => {
    // A product this role cannot see and one that does not exist are indistinguishable under RLS,
    // and must stay that way: telling them apart would leak the existence of a draft.
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (product === null) notFound()

  const base = `/studio/catalog/products/${product.id}`

  return (
    <Stack gap={8}>
      <PageHeader
        level={1}
        title={product.title ?? t('studio.catalog.products.untitled')}
        description={product.slug}
        actions={<StatusPill status={product.status} />}
      />

      <Link href={'/studio/catalog/products' as Route} className="underline underline-offset-4">
        <Text size="sm" as="span">
          {t('studio.catalog.products.caption')}
        </Text>
      </Link>

      {/*
        The strip is a client island so it can mark the active tab with `aria-current` — see the
        note in ProductTabs. Its labels are resolved here and passed down, so the component itself
        holds no copy: `t()` is client-safe and other Studio islands do import it, but a navigation
        component has no reason to pull the whole string table into its bundle.
      */}
      <ProductTabs
        basePath={base}
        label={t('studio.catalog.product.tabs.label')}
        tabs={TABS.map((tab) => ({ segment: tab.segment, label: t(tab.key) }))}
      />

      {children}
    </Stack>
  )
}
