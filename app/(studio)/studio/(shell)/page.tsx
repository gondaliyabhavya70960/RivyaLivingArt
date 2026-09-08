import Link from 'next/link'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t, type StudioStringKey } from '@/components/studio/strings'
import { ROLE_PERMISSIONS, type Role } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import {
  cardsForRole,
  cardTableExists,
  isCardAvailable,
  type DashboardCard,
} from '@/lib/analytics/dashboard-cards'
import { readActivityFeed } from '@/lib/logging/activity'
import { createClient } from '@/lib/supabase/server'
import {
  countCollections,
  countMediaAssets,
  countProducts,
  countProductsByStatus,
  type MetricCount,
} from '@/lib/supabase/repositories/metrics'

/**
 * `/studio` — the Overview. The one Studio surface Phase 05 fills rather than stubs.
 *
 * D4 gives it three tabs: Overview, Analytics, Activity. Analytics is Phase 37's and says so.
 *
 * TABS ARE A QUERY PARAMETER, NOT CLIENT STATE. The whole page is a Server Component, so a tab is a
 * link and the browser's back button works, the state survives a reload, and a colleague can be
 * sent a URL that opens on the tab being discussed. Client-side tabs would buy an instant switch
 * and cost all three.
 */
export const metadata = studioMetadata('/studio')

type Tab = 'overview' | 'analytics' | 'activity'
const TABS: readonly { id: Tab; labelKey: StudioStringKey }[] = [
  { id: 'overview', labelKey: 'studio.overview.tabOverview' },
  { id: 'analytics', labelKey: 'studio.overview.tabAnalytics' },
  { id: 'activity', labelKey: 'studio.overview.tabActivity' },
]

export default async function StudioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('studio.access')
  const params = await searchParams

  // An unknown ?tab= falls back rather than 404s: a mistyped or stale URL should land somewhere
  // usable, and there is nothing here worth refusing over.
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const tab: Tab = TABS.some((candidate) => candidate.id === requested)
    ? (requested as Tab)
    : 'overview'

  return (
    <StudioPage path="/studio">
      <Stack gap={6}>
        <nav aria-label={t('studio.overview.tabsLabel')}>
          <ul className="flex list-none gap-4 p-0">
            {TABS.map((candidate) => (
              <li key={candidate.id}>
                <Link
                  href={candidate.id === 'overview' ? '/studio' : `/studio?tab=${candidate.id}`}
                  aria-current={candidate.id === tab ? 'page' : undefined}
                  className="rounded-sm"
                >
                  <Text
                    size="sm"
                    tone={candidate.id === tab ? 'primary' : 'secondary'}
                    className={candidate.id === tab ? 'underline underline-offset-4' : undefined}
                  >
                    {t(candidate.labelKey)}
                  </Text>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {tab === 'overview' && <OverviewTab role={session.role} />}
        {tab === 'analytics' && (
          <Surface level={1} className="p-6">
            <Text tone="secondary">{t('studio.analytics.stub')}</Text>
          </Surface>
        )}
        {tab === 'activity' && <ActivityTab />}
      </Stack>
    </StudioPage>
  )
}

/* ------------------------------------------------------------------------------ Overview tab */

async function OverviewTab({ role }: { role: Role }) {
  const cards = cardsForRole(ROLE_PERMISSIONS[role])
  const counts = await readCounts()

  return (
    <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <li key={card.id}>
          <Card card={card} value={counts[card.id]} />
        </li>
      ))}
    </ul>
  )
}

/**
 * The counts Phase 05 can actually source.
 *
 * Keyed by card id, and every card NOT listed here resolves to `undefined` — which the renderer
 * shows as unavailable rather than as zero. That is the whole rule: a card shows a number only when
 * a query behind it returned one.
 */
async function readCounts(): Promise<Record<string, MetricCount>> {
  try {
    const supabase = await createClient()
    const [products, published, draft, collections, media] = await Promise.all([
      countProducts(supabase),
      countProductsByStatus(supabase, 'PUBLISHED'),
      countProductsByStatus(supabase, 'DRAFT'),
      countCollections(supabase),
      countMediaAssets(supabase),
    ])
    return {
      products,
      'products-published': published,
      'products-draft': draft,
      collections,
      'media-assets': media,
    }
  } catch {
    return {}
  }
}

function Card({ card, value }: { card: DashboardCard; value: MetricCount | undefined }) {
  const available = isCardAvailable(card) && cardTableExists(card)

  return (
    <Surface level={1} className="h-full p-4">
      <Stack gap={1}>
        <Text size="2xs" uppercase tone="tertiary">
          {t(card.labelKey as StudioStringKey)}
        </Text>

        {!available ? (
          // Never a zero. "Open enquiries: 0" reads as "nobody has enquired" when the truth is that
          // enquiries do not exist yet — a fabricated business fact, which D10 forbids.
          <Text size="sm" tone="secondary">
            {t('studio.card.unavailable')} {String(card.availableFromPhase).padStart(2, '0')}
          </Text>
        ) : value === null || value === undefined ? (
          <Text size="sm" tone="secondary">
            {t('studio.card.unreadable')}
          </Text>
        ) : (
          <Heading level={2} size="display-sm">
            {value.toLocaleString('en-IN')}
          </Heading>
        )}
      </Stack>
    </Surface>
  )
}

/* ------------------------------------------------------------------------------ Activity tab */

async function ActivityTab() {
  const { events, failed } = await readActivityFeed({ limit: 50 })

  if (failed) {
    return (
      <Surface level={1} className="p-6">
        <Text tone="secondary">{t('studio.activity.failed')}</Text>
      </Surface>
    )
  }

  if (events.length === 0) {
    return (
      <Surface level={1} className="p-6">
        <Text tone="secondary">{t('studio.activity.empty')}</Text>
      </Surface>
    )
  }

  return (
    <Stack as="ul" gap={3} className="list-none p-0">
      {events.map((event) => (
        <li key={event.id}>
          <Surface level={1} className="p-4">
            <Stack gap={1}>
              <Text size="sm">{event.summary ?? event.action}</Text>
              <Text size="xs" tone="tertiary">
                {event.actor_role ?? 'system'} ·{' '}
                <time dateTime={event.occurred_at}>{event.occurred_at}</time>
                {event.entity_label !== null && ` · ${event.entity_label}`}
              </Text>
            </Stack>
          </Surface>
        </li>
      ))}
    </Stack>
  )
}
