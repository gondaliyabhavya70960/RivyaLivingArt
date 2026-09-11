import type { Route } from 'next'
import Link from 'next/link'

import { Text } from '@/components/primitives/Text'
import { t, type StudioStringKey } from '@/components/studio/strings'

/**
 * The seven tabs of `/studio/content/seo` — Phase 39. A query parameter, not client state: the
 * whole page is a Server Component, and a tab is a URL a colleague can be sent.
 */
export const SEO_TABS = [
  'global',
  'pages',
  'entities',
  'keywords',
  'structured-data',
  'redirects',
  'coverage',
] as const
export type SeoTab = (typeof SEO_TABS)[number]

const LABEL: Readonly<Record<SeoTab, StudioStringKey>> = {
  global: 'studio.seo.tab.global',
  pages: 'studio.seo.tab.pages',
  entities: 'studio.seo.tab.entities',
  keywords: 'studio.seo.tab.keywords',
  'structured-data': 'studio.seo.tab.structuredData',
  redirects: 'studio.seo.tab.redirects',
  coverage: 'studio.seo.tab.coverage',
}

export function seoTabFrom(raw: string | string[] | undefined): SeoTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  return (SEO_TABS as readonly string[]).includes(value ?? '') ? (value as SeoTab) : 'global'
}

export function seoTabHref(tab: SeoTab, params: Readonly<Record<string, string>> = {}): Route {
  const search = new URLSearchParams({ tab, ...params })
  return `/studio/content/seo?${search.toString()}` as Route
}

export function SeoTabs({ current }: { readonly current: SeoTab }) {
  return (
    <nav aria-label={t('studio.seo.tabsLabel')} data-seo-tabs="">
      <ul className="flex list-none flex-wrap gap-4 p-0">
        {SEO_TABS.map((tab) => (
          <li key={tab}>
            <Link
              href={seoTabHref(tab)}
              aria-current={tab === current ? 'page' : undefined}
              className="rounded-sm"
              data-seo-tab={tab}
            >
              <Text
                size="sm"
                tone={tab === current ? 'primary' : 'secondary'}
                className={tab === current ? 'underline underline-offset-4' : undefined}
              >
                {t(LABEL[tab])}
              </Text>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
