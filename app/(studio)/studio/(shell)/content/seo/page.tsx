import type * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField } from '@/components/studio/FormField'
import { Button } from '@/components/primitives/Button'
import { CoveragePanel } from '@/components/studio/seo/CoveragePanel'
import { EntitiesTable } from '@/components/studio/seo/EntitiesTable'
import { GlobalSeoForm } from '@/components/studio/seo/GlobalSeoForm'
import { KeywordsTable } from '@/components/studio/seo/KeywordsTable'
import { PagesTable } from '@/components/studio/seo/PagesTable'
import { RedirectsTable } from '@/components/studio/seo/RedirectsTable'
import { SeoEntryForm, type SeoFormOption } from '@/components/studio/seo/SeoEntryForm'
import { SeoTabs, seoTabFrom, type SeoTab } from '@/components/studio/seo/SeoTabs'
import { StructuredDataPanel, type GateState } from '@/components/studio/seo/StructuredDataPanel'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { currencyExponent } from '@/lib/catalog/price'
import { optionalEnv } from '@/lib/env'
import { siteOrigin } from '@/lib/seo/canonical'
import { coverageReport } from '@/lib/seo/coverage'
import {
  articleJsonLd,
  collectionJsonLd,
  contactPointJsonLd,
  faqPageJsonLd,
  graphOf,
  productJsonLd,
} from '@/lib/seo/jsonld'
import { siteJsonLd } from '@/lib/seo/site-graph'
import { coverageRows, resolveForStudio } from '@/lib/seo/studio-resolution'
import {
  getCollectionByIdForStudio,
  getProductById,
  listCategoriesForStudio,
  listMaterialsForStudio,
  listProductMaterialIds,
} from '@/lib/supabase/repositories/catalog-admin'
import {
  getContactDetailsSection,
  listFaqs,
  listGlobalContent,
} from '@/lib/supabase/repositories/cms'
import { getArticleByIdForStudio } from '@/lib/supabase/repositories/journal'
import { listKeywordThemes } from '@/lib/supabase/repositories/keywords'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { listRedirects } from '@/lib/supabase/repositories/redirects'
import { isSeoEntityType, structuredDataFacts } from '@/lib/supabase/repositories/seo'
import { createClient } from '@/lib/supabase/server'
import { contactDetailsOf } from '@/lib/site/contact-details'

import {
  deleteKeywordThemeAction,
  deleteRedirectAction,
  deleteSeoEntryAction,
  saveGlobalSeoAction,
  saveKeywordThemeAction,
  saveRedirectAction,
  saveSeoEntryAction,
  setRedirectStatusAction,
  setSeoEntryStatusAction,
} from './actions'

/**
 * `/studio/content/seo` — Phase 39. Seven tabs, one query parameter each.
 *
 *   global           the SEED §41/§44 defaults
 *   pages            one row per D3 path, resolved, with the level each field came from
 *   entities         products, categories, collections, projects, articles; "derived only" filter
 *   keywords         the §42 themes as research targets — no number anywhere
 *   structured-data  the allowlist, gate by gate, and a read-only rendering for a chosen entity
 *   redirects        list, add, pause, resume, delete, test a path, chain warnings
 *   coverage         counts of rows in a named state
 *
 * READ IS `content.read`, EVERY WRITE IS `seo.write` (checked again in the action), publishing
 * `content.publish`, deleting an entry `destructive.execute` — the permission each control's
 * policy actually names. Every tab shows the resolution level beside every field, so an editor
 * always knows whether they are reading their own words or a default.
 */
export const metadata = studioMetadata('/studio/content/seo')
export const dynamic = 'force-dynamic'

const one = (value: string | string[] | undefined): string | null => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('content.read')
  const params = await searchParams
  const tab: SeoTab = seoTabFrom(params.tab)
  const client = await createClient()

  const canWrite = roleHasPermission(session.role, 'seo.write')
  const canPublish = roleHasPermission(session.role, 'content.publish')
  const canDelete = roleHasPermission(session.role, 'destructive.execute')

  const [resolution, seoStrings, socialStrings, media] = await Promise.all([
    resolveForStudio(client),
    listGlobalContent(client, 'SEO_DEFAULT'),
    listGlobalContent(client, 'SOCIAL'),
    listMediaAssets(client, { kind: 'IMAGE', limit: 500 }),
  ])
  const string = (rows: typeof seoStrings, key: string): string =>
    rows.find((row) => row.key === key)?.value ?? ''
  const template = string(seoStrings, 'title_template') || null
  const mediaOptions: SeoFormOption[] = media.map((asset) => ({
    value: asset.id,
    label: `${asset.title ?? asset.public_id}${asset.is_concept ? ` — ${t('studio.seo.field.conceptAsset')}` : ''}`,
  }))

  let body: React.ReactNode
  switch (tab) {
    case 'global':
      body = (
        <GlobalSeoForm
          entry={resolution.global}
          strings={{
            siteName: string(seoStrings, 'site_name'),
            titleTemplate: string(seoStrings, 'title_template'),
            ogHeadline: string(socialStrings, 'og_headline'),
            ogDescription: string(socialStrings, 'og_description'),
          }}
          mediaOptions={mediaOptions}
          action={saveGlobalSeoAction}
          canWrite={canWrite}
        />
      )
      break

    case 'pages': {
      const path = one(params.path)
      const row =
        path === null ? null : (resolution.pages.find((page) => page.path === path) ?? null)
      body = (
        <Stack gap={6}>
          {row === null ? null : (
            <SeoEntryForm
              target={{ scope: 'PATH', path: row.path }}
              entityPath={row.path}
              entry={row.entry}
              resolved={row.resolved}
              template={template}
              mediaOptions={mediaOptions}
              saveAction={saveSeoEntryAction}
              statusAction={setSeoEntryStatusAction}
              deleteAction={deleteSeoEntryAction}
              canWrite={canWrite}
              canPublish={canPublish}
              canDelete={canDelete}
            />
          )}
          <PagesTable rows={resolution.pages} />
        </Stack>
      )
      break
    }

    case 'entities': {
      const type = one(params.entity_type)
      const id = one(params.entity_id)
      const row =
        type !== null && id !== null && isSeoEntityType(type)
          ? (resolution.entities.find((entity) => entity.type === type && entity.id === id) ?? null)
          : null
      body = (
        <Stack gap={6}>
          {row === null ? null : (
            <SeoEntryForm
              target={{ scope: 'ENTITY', entityType: row.type, entityId: row.id }}
              entityPath={row.path}
              entry={row.entry}
              resolved={row.resolved}
              template={template}
              mediaOptions={mediaOptions}
              saveAction={saveSeoEntryAction}
              statusAction={setSeoEntryStatusAction}
              deleteAction={deleteSeoEntryAction}
              canWrite={canWrite}
              canPublish={canPublish}
              canDelete={canDelete}
            />
          )}
          <EntitiesTable rows={resolution.entities} derivedOnly={one(params.derived) === '1'} />
        </Stack>
      )
      break
    }

    case 'keywords': {
      const themes = await listKeywordThemes(client)
      body = (
        <KeywordsTable
          themes={themes}
          saveAction={saveKeywordThemeAction}
          deleteAction={deleteKeywordThemeAction}
          canWrite={canWrite}
        />
      )
      break
    }

    case 'structured-data': {
      body = await structuredDataTab(client, params, resolution)
      break
    }

    case 'redirects': {
      const redirects = await listRedirects(client)
      body = (
        <RedirectsTable
          redirects={redirects}
          test={one(params.test)}
          saveAction={saveRedirectAction}
          statusAction={setRedirectStatusAction}
          deleteAction={deleteRedirectAction}
          canWrite={canWrite}
        />
      )
      break
    }

    case 'coverage': {
      const themes = await listKeywordThemes(client)
      body = <CoveragePanel report={coverageReport(coverageRows(resolution), themes)} />
      break
    }
  }

  return (
    <StudioPage path="/studio/content/seo">
      <Stack gap={6}>
        <Text size="sm" tone="secondary">
          {t('studio.seo.intro')}
        </Text>
        <SeoTabs current={tab} />
        {body}
      </Stack>
    </StudioPage>
  )
}

/** The Structured Data tab: the gate table from live facts, plus the chosen rendering. */
async function structuredDataTab(
  client: Awaited<ReturnType<typeof createClient>>,
  params: Record<string, string | string[] | undefined>,
  resolution: Awaited<ReturnType<typeof resolveForStudio>>,
): Promise<React.ReactNode> {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  const [brand, facts, faqs, contactSection] = await Promise.all([
    listGlobalContent(client, 'BRAND'),
    structuredDataFacts(client),
    listFaqs(client),
    getContactDetailsSection(client),
  ])
  const brandRow = brand.find((row) => row.key === 'brand.name') ?? null
  const brandOpen =
    brandRow !== null && brandRow.owner_verification !== 'OWNER_VERIFICATION_REQUIRED'
  const published = (type: string) =>
    resolution.entities.filter((row) => row.type === type && row.status === 'PUBLISHED').length
  const total = (type: string) => resolution.entities.filter((row) => row.type === type).length
  const verifiedFaqs = faqs.filter(
    (row) => row.status === 'PUBLISHED' && row.owner_verification === 'VERIFIED',
  ).length
  const contactVerified = contactSection?.owner_verification === 'VERIFIED'
  const originLine = origin === null ? t('studio.seo.structured.noOrigin') : origin
  const ratio = (a: number, b: number, key: 'products' | 'collections' | 'articles' | 'faqs') =>
    t(`studio.seo.structured.count.${key}`).replace('{{a}}', String(a)).replace('{{b}}', String(b))

  const gates: GateState[] = [
    {
      type: 'Organization',
      routeKey: 'studio.seo.structured.route.layout',
      gateKey: 'studio.seo.structured.gate.organization',
      state: origin !== null && brandOpen ? 'open' : 'closed',
      detail: brandOpen ? originLine : t('studio.seo.structured.brandAwaiting'),
    },
    {
      type: 'WebSite',
      routeKey: 'studio.seo.structured.route.layout',
      gateKey: 'studio.seo.structured.gate.website',
      state: origin !== null ? 'open' : 'closed',
      detail: originLine,
    },
    {
      type: 'BreadcrumbList',
      routeKey: 'studio.seo.structured.route.entities',
      gateKey: 'studio.seo.structured.gate.breadcrumb',
      state: origin !== null ? 'open' : 'closed',
      detail: originLine,
    },
    {
      type: 'Product',
      routeKey: 'studio.seo.structured.route.product',
      gateKey: 'studio.seo.structured.gate.product',
      state:
        facts.productsWithOffers > 0 ? 'open' : facts.productsPublished > 0 ? 'partial' : 'closed',
      detail: ratio(facts.productsWithOffers, facts.productsPublished, 'products'),
    },
    {
      type: 'CollectionPage',
      routeKey: 'studio.seo.structured.route.collection',
      gateKey: 'studio.seo.structured.gate.collection',
      state: published('collections') > 0 ? 'open' : 'closed',
      detail: ratio(published('collections'), total('collections'), 'collections'),
    },
    {
      type: 'Article',
      routeKey: 'studio.seo.structured.route.article',
      gateKey: 'studio.seo.structured.gate.article',
      state: published('journal_articles') > 0 ? 'open' : 'closed',
      detail: ratio(published('journal_articles'), total('journal_articles'), 'articles'),
    },
    {
      type: 'FAQPage',
      routeKey: 'studio.seo.structured.route.faq',
      gateKey: 'studio.seo.structured.gate.faq',
      state: verifiedFaqs > 0 ? (verifiedFaqs === faqs.length ? 'open' : 'partial') : 'closed',
      detail: ratio(verifiedFaqs, faqs.length, 'faqs'),
    },
    {
      type: 'ContactPoint',
      routeKey: 'studio.seo.structured.route.contact',
      gateKey: 'studio.seo.structured.gate.contact',
      state: contactVerified ? 'open' : 'closed',
      detail: contactVerified
        ? t('studio.seo.structured.contactVerified')
        : t('studio.seo.structured.contactAwaiting'),
    },
  ]

  const type = one(params.type)
  const id = one(params.entity_id)
  const rendering = await renderingFor(client, resolution, type, id, {
    origin,
    faqs,
    contactSection,
  })

  const chooser = (
    <form
      method="get"
      action="/studio/content/seo"
      className="grid gap-3 md:grid-cols-3"
      data-seo-structured-chooser=""
    >
      <input type="hidden" name="tab" value="structured-data" />
      <SelectField
        name="type"
        label={t('studio.seo.structured.chooseType')}
        defaultValue={type ?? ''}
        options={[
          { value: '', label: t('studio.seo.field.none') },
          ...[
            'Organization',
            'Product',
            'CollectionPage',
            'Article',
            'FAQPage',
            'ContactPoint',
          ].map((value) => ({ value, label: value })),
        ]}
      />
      <SelectField
        name="entity_id"
        label={t('studio.seo.structured.chooseEntity')}
        help={t('studio.seo.structured.chooseEntityHelp')}
        defaultValue={id ?? ''}
        options={[
          { value: '', label: t('studio.seo.field.none') },
          ...resolution.entities
            .filter((row) => ['products', 'collections', 'journal_articles'].includes(row.type))
            .map((row) => ({ value: row.id, label: `${row.name ?? row.slug} (${row.path})` })),
        ]}
      />
      <div className="self-end">
        <Button type="submit" size="sm" variant="secondary" data-seo-structured-render="">
          {t('studio.seo.structured.render')}
        </Button>
      </div>
    </form>
  )

  return (
    <Stack gap={6}>
      <StructuredDataPanel gates={gates} rendering={rendering} />
      {chooser}
    </Stack>
  )
}

async function renderingFor(
  client: Awaited<ReturnType<typeof createClient>>,
  resolution: Awaited<ReturnType<typeof resolveForStudio>>,
  type: string | null,
  id: string | null,
  facts: {
    readonly origin: string | null
    readonly faqs: Awaited<ReturnType<typeof listFaqs>>
    readonly contactSection: Awaited<ReturnType<typeof getContactDetailsSection>>
  },
): Promise<{ label: string; graph: object | null } | null> {
  if (type === null) return null
  const label = t('studio.seo.structured.renderingLabel').replace('{{type}}', type)
  const absolute = (path: string): string =>
    facts.origin === null ? path : new URL(path, facts.origin).toString()

  if (type === 'Organization' || type === 'WebSite') {
    return { label, graph: await siteJsonLd() }
  }
  if (type === 'FAQPage') return { label, graph: graphOf([faqPageJsonLd(facts.faqs)]) }
  if (type === 'ContactPoint') {
    const details = contactDetailsOf(facts.contactSection)
    return {
      label,
      graph: graphOf([
        contactPointJsonLd({
          verified: facts.contactSection?.owner_verification === 'VERIFIED',
          email: details?.email ?? null,
          phone: details?.phone ?? null,
          url: absolute('/contact'),
        }),
      ]),
    }
  }
  if (id === null) return { label, graph: null }
  const entity = resolution.entities.find((row) => row.id === id) ?? null
  if (entity === null) return { label, graph: null }

  if (type === 'Product' && entity.type === 'products') {
    const [product, categories, materialIds, materials] = await Promise.all([
      getProductById(client, id),
      listCategoriesForStudio(client),
      listProductMaterialIds(client, id),
      listMaterialsForStudio(client),
    ])
    const category = categories.find((row) => row.id === product.category_id) ?? null
    const node = productJsonLd({
      product,
      url: absolute(entity.path),
      brandName: null,
      category,
      imageUrls: [],
      materialNames: materials
        .filter((material) => materialIds.includes(material.id))
        .map((material) => material.name),
      formatAmount: (minor, currency) => {
        const exponent = currencyExponent(currency)
        return exponent === null ? null : (minor / 10 ** exponent).toFixed(exponent)
      },
    })
    return { label, graph: graphOf([node]) }
  }
  if (type === 'CollectionPage' && entity.type === 'collections') {
    const collection = await getCollectionByIdForStudio(client, id)
    return { label, graph: graphOf([collectionJsonLd(collection, absolute(entity.path), null)]) }
  }
  if (type === 'Article' && entity.type === 'journal_articles') {
    const article = await getArticleByIdForStudio(client, id)
    const organisation = resolution.global?.title ?? ''
    return {
      label,
      graph: graphOf([
        articleJsonLd(article, {
          url: absolute(entity.path),
          organisationName: organisation,
          imageUrl: null,
          categoryName: null,
        }),
      ]),
    }
  }
  return { label, graph: null }
}
