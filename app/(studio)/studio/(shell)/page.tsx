import Link from 'next/link'
import type { Route } from 'next'

import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActorChip } from '@/components/studio/ActorChip'
import { EmptyState } from '@/components/studio/EmptyState'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { AnalyticsTab } from '@/components/studio/analytics/AnalyticsTab'
import { StatCard } from '@/components/studio/StatCard'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { TodayList, type TodayRow } from '@/components/studio/TodayList'
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
  countSourcesAwaitingPolicy,
  countUnarchivedConfirmations,
  countUndecidedMaterialChanges,
  countUnpublishedSections,
  countUnreadInquiries,
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
  const [counts, today] = await Promise.all([readCounts(), readToday(role)])

  return (
    <Stack gap={4}>
      {/* The work list sits ABOVE the registry grid because it is the one block on this page that is
          a TASK rather than a measure. Phase 46 made that argument for the verification card alone;
          Phase C is the same argument for the other three queues, and the card is now a row in it —
          one number for one thing, read from one place. */}
      <TodayList rows={today} />

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

/* ---------------------------------------------------------- The "today" rows (Phase C) */

/**
 * The four queues §9 names for this phase, each read once and each gated on the permission that
 * lets the reader CLEAR it rather than merely see it.
 *
 * WHY THE ROW SET IS BUILT HERE AND NOT INSIDE `TodayList`. The component renders rows; it does not
 * know which ones a role may act on, and it must not — a presentational component that reads
 * permissions is a second authorisation surface to keep in step with `ROLE_PERMISSIONS`. Deciding
 * here keeps the one rule in one place, and the component stays a thing you can render in a test
 * with four literal rows.
 *
 * VERIFICATIONS IS A ROW HERE RATHER THAN A CARD OF ITS OWN, WHICH IS A CHANGE FROM PHASE 46. It
 * was the only task-shaped block on this page, so it needed its own frame; now it is one of four,
 * and two blocks showing the same number in different shapes is how the two come to disagree. Its
 * per-surface breakdown survives as the row's `detail`, because that is the part `TodayList` cannot
 * express and the part an owner actually navigates by.
 *
 * THE COUNT STILL COMES FROM `countOutstandingVerifications`, over the one declaration in
 * `lib/cms/verification-backlog.ts` that `scripts/content/build-verification-report.ts` also reads.
 * §12's acceptance test is that the Overview and that module agree; they agree because there is
 * only ever one count.
 */
async function readToday(role: Role): Promise<readonly TodayRow[]> {
  const canVerify = roleHasPermission(role, 'content.verify')
  const canReadInquiries = roleHasPermission(role, 'inquiries.read')
  const canWriteContent = roleHasPermission(role, 'content.write')
  const canReadResearch = roleHasPermission(role, 'research.read')

  /*
   * Only the reads this role will actually use. A count nobody is shown is a query nobody needed,
   * and on a page that already fires eighteen of them that is worth not adding to.
   */
  const [verifications, unread, sections, sources] = await Promise.all([
    canVerify ? readOutstandingVerifications() : Promise.resolve(null),
    canReadInquiries ? readCount(countUnreadInquiries) : Promise.resolve(null),
    canWriteContent ? readCount(countUnpublishedSections) : Promise.resolve(null),
    canReadResearch ? readCount(countSourcesAwaitingPolicy) : Promise.resolve(null),
  ])

  const rows: TodayRow[] = []

  if (canVerify) {
    rows.push({
      id: 'verifications',
      label: t('studio.today.rowVerifications'),
      count: verificationTotal(verifications),
      // §8's primary action for this screen: "Open verification backlog". The nearest surface the
      // manifest declares is the one where most of these rows are cleared.
      href: '/studio/content/pages',
      detail: <VerificationDetail read={verifications} />,
    })
  }
  if (canReadInquiries) {
    rows.push({
      id: 'inquiries',
      label: t('studio.today.rowInquiries'),
      count: unread,
      href: '/studio/inquiries/all',
    })
  }
  if (canWriteContent) {
    rows.push({
      id: 'sections',
      label: t('studio.today.rowSections'),
      count: sections,
      href: '/studio/content/pages',
    })
  }
  if (canReadResearch) {
    rows.push({
      id: 'sources',
      label: t('studio.today.rowSources'),
      count: sources,
      href: '/studio/research/sources',
    })
  }

  return rows
}

/** One count, with a failed client build treated the same as a failed query: `null`, never `0`. */
async function readCount(
  read: (client: Awaited<ReturnType<typeof createClient>>) => Promise<MetricCount>,
): Promise<MetricCount> {
  try {
    return await read(await createClient())
  } catch {
    return null
  }
}

/**
 * The verification figure, or `null` when nobody can vouch for it.
 *
 * A TOTAL EXISTS ONLY WHEN AT LEAST ONE OF THE TWENTY-TWO TABLES ANSWERED. `null` means either that
 * the client could not be built or that every head-count failed, and in both cases the row must say
 * so: a zero would be read as "nothing left to confirm", which is the one thing nobody knows.
 *
 * A PARTIAL READ STILL YIELDS A NUMBER, and that is deliberate rather than sloppy. One unreadable
 * table out of twenty-two makes the figure a FLOOR rather than a total — worth showing with the
 * caveat the detail block carries, rather than throwing away a figure that is certainly not lower.
 */
function verificationTotal(read: OutstandingVerifications | null): MetricCount {
  if (read === null || read.unreadable.length >= VERIFICATION_TABLES.length) return null
  return read.total
}

/**
 * The verification row's expansion: the caveat when the read was partial, and where each group is
 * cleared.
 *
 * WHERE THESE LINK, AND WHY NOT THE DOCUMENTATION VIEWER. The backlog document is
 * `docs/content/INITIAL_CONTENT_INVENTORY.md`, which is not one of the ten allowlist KEYS the
 * viewer serves (`lib/cms/docs/allowlist.ts`), so `/studio/system/documentation/...` would 404 —
 * and that allowlist is a security boundary, so widening it to make a link work would be exactly
 * the silent scope creep it exists to prevent. The useful destination is the screen where each
 * group is CLEARED, read from the same declaration the document is generated from, so the two can
 * never point somewhere different. The document's own path is named in words below, along with the
 * fact that the Studio does not serve it.
 */
function VerificationDetail({ read }: { readonly read: OutstandingVerifications | null }) {
  const outstanding =
    read !== null && read.unreadable.length < VERIFICATION_TABLES.length ? read : null

  return (
    <Stack
      gap={1}
      className="px-1 pb-1"
      data-outstanding-verifications=""
      /*
       * THE FIGURE MOVED TO THE ROW, THE HOOK STAYED HERE, AND THAT IS ON PURPOSE.
       * `tests/e2e/studio-system.spec.ts` asserts that exactly one of `-total` and `-unreadable`
       * appears inside `[data-outstanding-verifications]` — the invariant being that a zero can
       * never arrive by both being absent. That invariant is still exactly right; only the place
       * the number is DRAWN changed. Re-rendering the figure here to satisfy the selector would
       * put the same count on the screen twice, which is the duplication this phase removed.
       */
      {...(outstanding === null
        ? {}
        : { 'data-outstanding-verifications-total': String(outstanding.total) })}
    >
      {outstanding === null ? (
        <Text size="xs" data-outstanding-verifications-unreadable="">
          {t('studio.overview.verifications.unreadable')}
        </Text>
      ) : (
        <>
          {outstanding.unreadable.length > 0 ? (
            <Text size="xs" data-outstanding-verifications-partial="">
              {t('studio.overview.verifications.partial')
                .replace('{{unreadable}}', String(outstanding.unreadable.length))
                .replace('{{tables}}', String(VERIFICATION_TABLES.length))}
            </Text>
          ) : null}

          <Text size="xs" tone="secondary">
            {outstanding.total === 0
              ? t('studio.overview.verifications.none')
              : t('studio.overview.verifications.body')}
          </Text>

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
  )
}

/**
 * The verification read, isolated so a failure is a `null` rather than a crashed overview.
 *
 * The count itself is NOT implemented here: `countOutstandingVerifications` is the shared reader
 * that `scripts/content/build-verification-report.ts` and this page both go through, over the one
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
