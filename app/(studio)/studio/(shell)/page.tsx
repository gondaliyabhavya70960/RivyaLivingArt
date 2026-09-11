import Link from 'next/link'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActorChip } from '@/components/studio/ActorChip'
import { EmptyState } from '@/components/studio/EmptyState'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { AnalyticsTab } from '@/components/studio/analytics/AnalyticsTab'
import { StatCard } from '@/components/studio/StatCard'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t, type StudioStringKey } from '@/components/studio/strings'
import { ROLE_PERMISSIONS, type Role } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { cardsForRole, cardTableExists, isCardAvailable } from '@/lib/analytics/dashboard-cards'
import { readActivityFeed } from '@/lib/logging/activity'
import { createClient } from '@/lib/supabase/server'
import {
  countCollections,
  countHiggsfieldPending,
  countJournalArticles,
  countLargeFormatPublished,
  countMediaAssets,
  countOpenCommissionInquiries,
  countOpenInquiries,
  countOpenShortlistEntries,
  countPortfolioProjects,
  countProducts,
  countProductsByStatus,
  countResearchProductsAwaitingReview,
  countResearchProductsNewLast7Days,
  countResearchRunsLast7Days,
  countResearchValidationErrors,
  countUnarchivedConfirmations,
  countUndecidedMaterialChanges,
  type MetricCount,
} from '@/lib/supabase/repositories/metrics'

/**
 * `/studio` — the Overview. The one Studio surface Phase 05 fills rather than stubs.
 *
 * D4 gives it three tabs: Overview, Analytics, Activity. Phase 37 filled Analytics and gave every
 * FEAT §17 card whose table exists a real count.
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
        {tab === 'analytics' && <AnalyticsTab role={session.role} />}
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
          <StatCard
            label={t(card.labelKey as StudioStringKey)}
            value={counts[card.id]}
            // The card is unavailable when the phase has not landed OR the relation is missing.
            // Both are checked: a phase number can be lowered by mistake, and the registry test
            // asserts the pair agree.
            unavailableFromPhase={
              isCardAvailable(card) && cardTableExists(card) ? undefined : card.availableFromPhase
            }
            unavailableLabel={t('studio.card.unavailable')}
            unreadableLabel={t('studio.card.unreadable')}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * The counts the cards can actually source — Phase 05's five, and from Phase 37 every card whose
 * table exists (STUDIO_GUIDE §5.3 gives each its definition).
 *
 * Keyed by card id, and every card NOT listed here resolves to `undefined` — which the renderer
 * shows as unavailable rather than as zero. That is the whole rule: a card shows a number only when
 * a query behind it returned one. A query that failed returns `null`, rendered as unreadable.
 */
async function readCounts(): Promise<Record<string, MetricCount>> {
  try {
    const supabase = await createClient()
    const [
      products,
      published,
      draft,
      collections,
      media,
      largeFormat,
      portfolio,
      journal,
      inquiriesOpen,
      inquiriesCommission,
      scraperRuns,
      competitorNew,
      competitorChanged,
      awaitingReview,
      shortlisted,
      confirmed,
      higgsfieldPending,
      dataQuality,
    ] = await Promise.all([
      countProducts(supabase),
      countProductsByStatus(supabase, 'PUBLISHED'),
      countProductsByStatus(supabase, 'DRAFT'),
      countCollections(supabase),
      countMediaAssets(supabase),
      countLargeFormatPublished(supabase),
      countPortfolioProjects(supabase),
      countJournalArticles(supabase),
      countOpenInquiries(supabase),
      countOpenCommissionInquiries(supabase),
      countResearchRunsLast7Days(supabase),
      countResearchProductsNewLast7Days(supabase),
      countUndecidedMaterialChanges(supabase),
      countResearchProductsAwaitingReview(supabase),
      countOpenShortlistEntries(supabase),
      countUnarchivedConfirmations(supabase),
      countHiggsfieldPending(supabase),
      countResearchValidationErrors(supabase),
    ])
    return {
      products,
      'products-published': published,
      'products-draft': draft,
      collections,
      'media-assets': media,
      'products-large-format': largeFormat,
      'portfolio-projects': portfolio,
      'journal-articles': journal,
      'inquiries-open': inquiriesOpen,
      'inquiries-commission': inquiriesCommission,
      'scraper-runs': scraperRuns,
      'competitor-products-new': competitorNew,
      'competitor-products-changed': competitorChanged,
      'products-awaiting-review': awaitingReview,
      'products-shortlisted': shortlisted,
      'products-confirmed': confirmed,
      'higgsfield-pending': higgsfieldPending,
      'data-quality-errors': dataQuality,
    }
  } catch {
    return {}
  }
}

/* ------------------------------------------------------------------------------ Activity tab */

async function ActivityTab() {
  const { events, failed } = await readActivityFeed({ limit: 50 })

  // The two zero-row cases are NOT the same and must not render the same. "Nothing has happened"
  // when the truth is "the feed could not be read" is the interface asserting something false that
  // the reader has no way to detect.
  if (failed) {
    return (
      <EmptyState
        reason="unreadable"
        heading={t('studio.activity.failedHeading')}
        body={t('studio.activity.failed')}
      />
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        reason="empty"
        heading={t('studio.activity.emptyHeading')}
        body={t('studio.activity.empty')}
      />
    )
  }

  return (
    <Stack as="ul" gap={3} className="list-none p-0">
      {events.map((event) => (
        <li key={event.id}>
          <Surface level={1} className="p-4">
            <Stack gap={1}>
              <Text size="sm">{event.summary ?? event.action}</Text>
              <div className="flex flex-wrap items-center gap-2">
                <ActorChip role={event.actor_role} />
                <RelativeTime value={event.occurred_at} />
                {event.entity_label !== null && (
                  <Text as="span" size="xs" tone="tertiary">
                    {event.entity_label}
                  </Text>
                )}
              </div>
            </Stack>
          </Surface>
        </li>
      ))}
    </Stack>
  )
}
