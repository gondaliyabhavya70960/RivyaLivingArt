import Link from 'next/link'
import type { Route } from 'next'

import { Heading } from '@/components/primitives/Heading'
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
import { ROLE_PERMISSIONS, roleHasPermission, type Role } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { cardsForRole, cardTableExists, isCardAvailable } from '@/lib/analytics/dashboard-cards'
import { VERIFICATION_TABLES } from '@/lib/cms/verification-backlog'
import { readActivityFeed } from '@/lib/logging/activity'
import { createClient } from '@/lib/supabase/server'
import {
  countOutstandingVerifications,
  type OutstandingVerifications,
} from '@/lib/supabase/repositories/verifications'
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
    <Stack gap={4}>
      {/* Phase 46's card sits ABOVE the registry grid rather than inside it, because it is the one
          thing on this page that is a task rather than a measure: every row it counts is blocking
          a publication until the owner acts. `content.verify` is the permission, so an editor or a
          researcher never sees a job they cannot do — and visibility is not authorisation: the
          counts run under RLS as the signed-in user regardless (`lib/auth/studio-nav.ts` states the
          same distinction for the sidebar). */}
      {roleHasPermission(role, 'content.verify') ? <OutstandingVerificationsCard /> : null}

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
    </Stack>
  )
}

/* ------------------------------------------------- Outstanding owner verifications (Phase 46) */

/**
 * "Outstanding owner verifications" — the overview's one Phase 46 addition, and the only place in
 * the product where the handover backlog appears at all. A list in a Markdown file is not where an
 * owner will look for the work still blocking publication.
 *
 * WHY IT IS NOT A ROW IN `DASHBOARD_CARDS`, WHICH IS WHERE EVERY OTHER CARD ON THIS PAGE LIVES.
 * The registry's contract is one card, one relation, one phase: `table` is a single
 * `ManagedTable`, `cardTableExists` checks that one name, and `availableFromPhase` means "the
 * relation does not exist yet". This number is a sum over the TWENTY-TWO tables carrying
 * `owner_verification`, so there is no honest value for `table` — naming one would make
 * `cardTableExists` assert something about a single table while the figure came from twenty-two —
 * and `availableFromPhase: 46` against `BUILT_THROUGH_PHASE = 36` would render it permanently
 * unavailable, which is the one thing that is NOT true here: every table it counts exists today,
 * and `lib/cms/verification-backlog.ts` is type-bound to the generated `Database` type so a missing
 * one would not compile. Raising `BUILT_THROUGH_PHASE` to make this card render would
 * simultaneously declare Missing Media (43) and System Health (38) answerable, which is a claim
 * about other phases' work rather than this one's.
 *
 * The registry's RULE, though, is obeyed exactly: a number appears only when a query returned it.
 * The failure modes are just finer-grained than `StatCard`'s three states can express — one
 * unreadable table out of twenty-two makes the figure a FLOOR rather than a total, which is worth
 * showing with a caveat rather than throwing away — and the card has to be a set of links, which
 * `StatCard` deliberately is not.
 */
async function OutstandingVerificationsCard() {
  const read = await readOutstandingVerifications()

  // A figure exists only when at least one of the twenty-two tables answered. `null` here means
  // either that the client could not be built or that every head-count failed — and in both cases
  // the card must say so, because a zero would be read as "nothing left to confirm".
  const outstanding =
    read !== null && read.unreadable.length < VERIFICATION_TABLES.length ? read : null

  return (
    <Surface level={1} className="p-4" data-outstanding-verifications="">
      <Stack gap={2}>
        <Text size="2xs" uppercase tone="tertiary">
          {t('studio.overview.verifications.heading')}
        </Text>

        {outstanding === null ? (
          <Text size="sm" data-outstanding-verifications-unreadable="">
            {t('studio.overview.verifications.unreadable')}
          </Text>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              {outstanding.unreadable.length > 0 ? (
                <Text as="span" size="sm" tone="secondary">
                  {t('studio.overview.verifications.atLeast')}
                </Text>
              ) : null}
              {/* en-IN grouping, as `StatCard` does: this Studio's readers read 1,00,000. */}
              <Heading
                level={2}
                size="display-sm"
                data-outstanding-verifications-total={String(outstanding.total)}
              >
                {outstanding.total.toLocaleString('en-IN')}
              </Heading>
            </div>

            {outstanding.unreadable.length > 0 ? (
              <Text size="xs" data-outstanding-verifications-partial="">
                {t('studio.overview.verifications.partial')
                  .replace('{{unreadable}}', String(outstanding.unreadable.length))
                  .replace('{{tables}}', String(VERIFICATION_TABLES.length))}
              </Text>
            ) : null}

            <Text size="sm" tone="secondary">
              {outstanding.total === 0
                ? t('studio.overview.verifications.none')
                : t('studio.overview.verifications.body')}
            </Text>

            {/* WHERE THE CARD LINKS, AND WHY IT IS NOT THE DOCUMENTATION VIEWER. The backlog
                document is `docs/content/INITIAL_CONTENT_INVENTORY.md`, which is not one of the ten
                allowlist KEYS the viewer serves (`lib/cms/docs/allowlist.ts`), so
                `/studio/system/documentation/...` would 404 — and that allowlist is a security
                boundary this very phase re-confirms, so widening it to make a card's link work
                would be precisely the silent scope creep it is there to prevent. The useful
                destination is therefore the screen where each group is CLEARED, read from the same
                declaration the document is generated from (`lib/cms/verification-backlog.ts`), so
                the card and the document can never point somewhere different. The document's own
                path is named in words below, along with the fact that the Studio does not serve
                it. */}
            {outstanding.surfaces.length > 0 ? (
              <ul
                aria-label={t('studio.overview.verifications.whereLabel')}
                className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0"
              >
                {outstanding.surfaces.map((surface) => (
                  <li key={surface.table} data-outstanding-verification-surface={surface.table}>
                    {surface.studio === null ? (
                      // The one surface with no editing screen. Stated, not linked to nowhere.
                      <Text as="span" size="xs" tone="tertiary">
                        {`${surface.surface} · ${surface.count.toLocaleString('en-IN')} · ${t('studio.overview.verifications.noScreen')}`}
                      </Text>
                    ) : (
                      <Link
                        href={surface.studio as Route}
                        className="rounded-sm underline underline-offset-4"
                      >
                        <Text as="span" size="xs">
                          {`${surface.surface} · ${surface.count.toLocaleString('en-IN')}`}
                        </Text>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}

        <Text size="xs" tone="tertiary" data-outstanding-verifications-backlog="">
          {t('studio.overview.verifications.backlog')}
        </Text>
      </Stack>
    </Surface>
  )
}

/**
 * The card's read, isolated so a failure is a `null` rather than a crashed overview.
 *
 * The count itself is NOT implemented here: `countOutstandingVerifications` is the shared reader
 * that `scripts/content/build-verification-report.ts` and this card both go through, over the one
 * declaration in `lib/cms/verification-backlog.ts`. A second count written at this call site would
 * disagree with the handover document the first time either changed, and the owner would have no
 * way to tell which figure was wrong.
 */
async function readOutstandingVerifications(): Promise<OutstandingVerifications | null> {
  try {
    const supabase = await createClient()
    return await countOutstandingVerifications(supabase)
  } catch {
    return null
  }
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
