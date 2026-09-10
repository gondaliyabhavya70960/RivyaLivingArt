import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { studioMetadata } from '@/components/studio/StudioPage'
import { CategoryMapEditor } from '@/components/studio/research/CategoryMapEditor'
import { HealthPill } from '@/components/studio/research/HealthPill'
import { PatternTester } from '@/components/studio/research/PatternTester'
import { PolicyReviewPanel } from '@/components/studio/research/PolicyReviewPanel'
import { ScheduleEditor } from '@/components/studio/research/ScheduleEditor'
import { SourceForm } from '@/components/studio/research/SourceForm'
import { UrlPatternEditor } from '@/components/studio/research/UrlPatternEditor'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listAdapterDescriptors } from '@/lib/scraper/adapters/registry'
import { hostOf, isAllowedByRules, parseRobots, agentToken } from '@/lib/scraper/core/robots'
import { testPatterns, type SourceUrlPattern } from '@/lib/scraper/core/url-patterns'
import { listCategoriesForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { readRobotsCache } from '@/lib/supabase/repositories/research/robots'
import {
  listCategoryMappings,
  listSourceSchedules,
  listUrlPatterns,
} from '@/lib/supabase/repositories/research/source-config'
import { getSourceHealth } from '@/lib/supabase/repositories/research/source-health'
import { getResearchSource } from '@/lib/supabase/repositories/research/sources'
import { createClient } from '@/lib/supabase/server'

import {
  deleteCategoryMappingAction,
  deleteScheduleAction,
  deleteUrlPatternAction,
  probeUrlAction,
  recordPolicyReviewAction,
  saveCategoryMappingAction,
  saveScheduleAction,
  saveSourceAction,
  saveUrlPatternAction,
  setReadinessAction,
  setSourceEnabledAction,
} from '../actions'

/**
 * /studio/research/sources/[sourceId] — one source, complete.
 *
 * EVERYTHING FEAT §26 NAMES IS ON THIS PAGE, and the ordering is the order somebody actually works
 * in: what the site is, how its URLs are shaped, whether those shapes are right, what its
 * categories mean, when it runs — and only then the two acts that are not configuration, which are
 * asking an owner for a decision and switching the source on.
 *
 * THE ENABLE CONTROL IS RENDERED DISABLED WITH ITS REASON rather than hidden. A hidden control
 * teaches nothing; a disabled one beside the sentence "a source cannot be switched on until its
 * policy review is recorded as approved" teaches the rule. The server action re-checks it anyway,
 * and the row refuses it underneath both.
 *
 * THE ROBOTS FILE IS READ, NEVER FETCHED. `research_robots_cache` is readable under
 * `research.read` and writable by nobody with a session — a member of staff able to write it could
 * tell the fetcher that a forbidden host permits everything — so the request-scoped client is
 * exactly the right one here, and opening this page never causes a request to a third party. The
 * cache is filled by the first fetch of a run, and until one has happened the panel says so.
 */
export const metadata = studioMetadata('/studio/research/sources')

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>
  searchParams: Promise<{ test?: string }>
}) {
  const session = await requirePermission('research.read')
  const { sourceId } = await params
  const { test } = await searchParams

  const client = await createClient()
  const source = await getResearchSource(client, sourceId)
  if (source === null) notFound()

  const [patterns, mappings, schedules, categories, health] = await Promise.all([
    listUrlPatterns(client, sourceId),
    listCategoryMappings(client, sourceId),
    listSourceSchedules(client, sourceId),
    listCategoriesForStudio(client),
    getSourceHealth(client, sourceId),
  ])

  const canWrite = roleHasPermission(session.role, 'research.write')
  const canDelete = roleHasPermission(session.role, 'destructive.execute')
  const canDecide = canWrite && roleHasPermission(session.role, 'system.settings.write')

  // THE CACHE, NOT THE NETWORK. See the header.
  const host = hostOf(source.base_url)
  const robots = host === null ? null : await readRobotsCache(client, host)

  const matchers: readonly SourceUrlPattern[] = patterns.map((row) => ({
    id: row.id,
    kind: row.kind as SourceUrlPattern['kind'],
    pattern: row.pattern,
    isRegex: row.is_regex,
    priority: row.priority,
  }))

  const testUrls =
    test === undefined
      ? null
      : test
          .split(/\s+/)
          .map((value) => value.trim())
          .filter((value) => value !== '')
          .slice(0, 100)

  /*
   * ROBOTS ANSWERED FROM THE CACHED BODY, AS A PURE FUNCTION. `testPatterns` takes a decision
   * FUNCTION rather than a client precisely so that this call cannot reach the network even by
   * accident — the tester's whole value is that twenty candidate URLs can be checked without a
   * single packet, including the ones that turn out to be disallowed.
   *
   * A MISSING `SCRAPER_USER_AGENT` ANSWERS `ERROR`, NOT `ALLOWED`, and it does not throw.
   * `scraperUserAgent()` has no fallback by design — an unconfigured deployment must not crawl
   * anonymously — but this page is mostly configuration, and a 500 on a screen where somebody is
   * typing a source's name would be a poor way to report a missing environment variable. Reading
   * the rules for the wrong agent would be worse: robots.txt commonly gives one agent narrower
   * rules than `*`, so a token invented here could report ALLOWED for a path Rivya's real agent is
   * refused. `ERROR` is the honest answer, and it is the one the fetcher already treats as a
   * refusal.
   */
  const configuredAgent = process.env.SCRAPER_USER_AGENT ?? ''
  const decide = (url: string): 'ALLOWED' | 'DISALLOWED' | 'NO_ROBOTS' | 'ERROR' => {
    if (configuredAgent === '') return 'ERROR'
    if (robots === null || robots.body === null) return 'ERROR'
    if (robots.body.trim() === '') return 'NO_ROBOTS'
    const rules = parseRobots(robots.body, agentToken(configuredAgent))
    return isAllowedByRules(rules, url) ? 'ALLOWED' : 'DISALLOWED'
  }

  const results = testUrls === null ? null : testPatterns(testUrls, matchers, decide)

  return (
    <Stack gap={6}>
      <PageHeader
        level={1}
        title={source.name}
        description={source.base_url}
        actions={
          <Stack gap={2}>
            <HealthPill health={health?.health ?? null} />
            <Badge tone={source.policy_status === 'APPROVED' ? 'success' : 'danger'}>
              {source.policy_status}
            </Badge>
          </Stack>
        }
      />
      <Link href={'/studio/research/sources' as Route} className="underline underline-offset-4">
        <Text size="sm" as="span">
          {t('studio.research.sourcesHeading')}
        </Text>
      </Link>

      <Surface level={1} className="p-6">
        <SourceForm
          action={saveSourceAction}
          canWrite={canWrite}
          adapters={listAdapterDescriptors().map((adapter) => ({
            key: adapter.key,
            version: adapter.version,
            capabilities: [...adapter.capabilities],
          }))}
          source={{
            id: source.id,
            slug: source.slug,
            name: source.name,
            base_url: source.base_url,
            region: source.region,
            currency: source.currency,
            source_type: source.source_type,
            analytics_league: source.analytics_league,
            collection_mode: source.collection_mode,
            adapter_key: source.adapter_key,
            image_extraction_mode: source.image_extraction_mode,
            price_extraction: source.price_extraction,
            sku_extraction: source.sku_extraction,
            attribute_extraction: source.attribute_extraction,
            rate_limit_rpm: source.rate_limit_rpm,
            request_delay_ms: source.request_delay_ms,
            concurrency: source.concurrency,
            notes: source.notes,
            readiness: source.readiness,
          }}
        />
      </Surface>

      <UrlPatternEditor
        sourceId={source.id}
        patterns={patterns}
        canWrite={canWrite}
        canDelete={canDelete}
        saveAction={saveUrlPatternAction}
        deleteAction={deleteUrlPatternAction}
      />

      <PatternTester
        sourceId={source.id}
        urlsValue={test ?? ''}
        results={results}
        canProbe={canWrite}
        probeAction={probeUrlAction}
      />

      <CategoryMapEditor
        sourceId={source.id}
        mappings={mappings}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        canWrite={canWrite}
        canDelete={canDelete}
        saveAction={saveCategoryMappingAction}
        deleteAction={deleteCategoryMappingAction}
      />

      <ScheduleEditor
        sourceId={source.id}
        schedules={schedules}
        canWrite={canWrite}
        canDelete={canDelete}
        saveAction={saveScheduleAction}
        deleteAction={deleteScheduleAction}
      />

      <Surface level={1} className="p-6">
        <Stack gap={4}>
          <PageHeader
            level={2}
            title={t('studio.research.readinessHeading')}
            actions={<Badge tone="neutral">{source.readiness}</Badge>}
          />
          <Text tone="secondary">{t('studio.research.readinessBody')}</Text>
          {canWrite && source.readiness === 'DRAFT' ? (
            <ActionForm action={setReadinessAction}>
              <input type="hidden" name="id" value={source.id} />
              <input type="hidden" name="readiness" value="READY_FOR_REVIEW" />
              <Button type="submit" variant="secondary">
                {t('studio.research.markReady')}
              </Button>
            </ActionForm>
          ) : null}
        </Stack>
      </Surface>

      <PolicyReviewPanel
        sourceId={source.id}
        policyStatus={source.policy_status}
        policyNotes={source.policy_notes}
        reviewedAt={source.policy_reviewed_at}
        robotsBody={robots?.body ?? null}
        canDecide={canDecide}
        action={recordPolicyReviewAction}
      />

      <Surface level={1} className="p-6">
        <Stack gap={4}>
          <PageHeader
            level={2}
            title={
              source.is_enabled
                ? t('studio.research.disableSource')
                : t('studio.research.enableSource')
            }
          />
          {source.policy_status === 'APPROVED' ? null : (
            // THE REASON, BESIDE THE DISABLED CONTROL. A hidden control teaches nothing.
            <Text tone="secondary" data-enable-blocked="">
              {t('studio.research.enableBlocked')}
            </Text>
          )}
          {canDecide ? (
            <ActionForm action={setSourceEnabledAction}>
              <Stack gap={3}>
                <input type="hidden" name="id" value={source.id} />
                <label className="flex items-center gap-2">
                  <Checkbox
                    name="enable"
                    defaultChecked={source.is_enabled}
                    disabled={source.policy_status !== 'APPROVED'}
                  />
                  <Text size="sm" as="span">
                    {t('studio.research.enableSource')}
                  </Text>
                </label>
                <div>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={source.policy_status !== 'APPROVED' && !source.is_enabled}
                  >
                    {t('studio.research.save')}
                  </Button>
                </div>
              </Stack>
            </ActionForm>
          ) : null}
        </Stack>
      </Surface>
    </Stack>
  )
}
