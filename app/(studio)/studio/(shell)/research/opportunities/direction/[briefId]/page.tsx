import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { Textarea } from '@/components/primitives/Textarea'
import { ActionForm } from '@/components/studio/ActionForm'
import { BriefStatusButton } from '@/components/studio/research/BriefStatusButton'
import {
  EvidenceRail,
  type AttachGroup,
  type EvidenceView,
} from '@/components/studio/research/EvidenceRail'
import { ObservedFigures } from '@/components/studio/research/ObservedFigures'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t, type StudioStringKey } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { D3_CATEGORY_SLUGS } from '@/lib/cms/merchandising-register'
import {
  parseCaptured,
  scoreDrift,
  snapshotDrift,
  type ObservedFigure,
} from '@/lib/scraper/analytics/direction/capture'
import {
  INTERNAL_DOCUMENT_HEADER,
  OBSERVED_LABEL,
  SECTION_TITLES,
  formatFigure,
} from '@/lib/scraper/analytics/direction/export'
import {
  getDirectionBrief,
  listBriefEvidence,
  listBriefRevisions,
  listComparisonSetRefs,
  listMoodAssets,
  listRecentScoreRefs,
  listRecentSnapshotRefs,
  newestScoreForProduct,
  newestSnapshotLike,
} from '@/lib/supabase/repositories/research/direction'
import {
  BRIEF_SECTIONS,
  type BriefEvidenceRow,
  type BriefSection,
} from '@/lib/supabase/schemas/research-direction'
import { createClient } from '@/lib/supabase/server'

import {
  attachEvidenceAction,
  detachEvidenceFormAction,
  restoreRevisionFormAction,
  saveBriefAction,
  setBriefStatusFormAction,
} from '../actions'
import './print.css'

/**
 * /studio/research/opportunities/direction/[briefId] — the editor, and (`?view=print`) the page a
 * maker reads.
 *
 * TWO COLUMN TYPES, VISUALLY DISTINCT. Left: the nine INTENDED sections — Rivya's own prose, with
 * helper copy that says so, and never a dimensions field. Right: the evidence rail and the
 * OBSERVED figures — numbers copied from research snapshots, each with its coverage badge and
 * the words "observed in competitor research". A permanent banner says the brief is an internal
 * research document and is never published. Approve and Archive sit behind the confirm dialog.
 */
export const metadata = studioMetadata('/studio/research/opportunities/direction')

const BASE = '/studio/research/opportunities/direction'

const SECTION_LABEL: Record<BriefSection, StudioStringKey> = {
  intent: 'studio.research.dirSecIntent',
  scale_intent: 'studio.research.dirSecScale',
  form_language: 'studio.research.dirSecForm',
  material_direction: 'studio.research.dirSecMaterial',
  finish_direction: 'studio.research.dirSecFinish',
  constraints: 'studio.research.dirSecConstraints',
  open_questions: 'studio.research.dirSecOpen',
  not_doing: 'studio.research.dirSecNotDoing',
}
const SECTION_HELP: Record<BriefSection, StudioStringKey> = {
  intent: 'studio.research.dirSecIntentHelp',
  scale_intent: 'studio.research.dirSecScaleHelp',
  form_language: 'studio.research.dirSecFormHelp',
  material_direction: 'studio.research.dirSecMaterialHelp',
  finish_direction: 'studio.research.dirSecFinishHelp',
  constraints: 'studio.research.dirSecConstraintsHelp',
  open_questions: 'studio.research.dirSecOpenHelp',
  not_doing: 'studio.research.dirSecNotDoingHelp',
}

function labelFor(row: BriefEvidenceRow): string {
  try {
    switch (row.evidence_type) {
      case 'COMPARISON_SET': {
        const c = parseCaptured('COMPARISON_SET', row.captured)
        return `${c.name} (${String(c.memberCount)} members)`
      }
      case 'ANALYTICS_SNAPSHOT': {
        const c = parseCaptured('ANALYTICS_SNAPSHOT', row.captured)
        return `${c.metricFamily}${c.currency === null ? '' : ` ${c.currency}`} · ${String(c.rowCount)} rows · ${c.computedAt.slice(0, 10)}`
      }
      case 'OPPORTUNITY_SCORE': {
        const c = parseCaptured('OPPORTUNITY_SCORE', row.captured)
        return `${c.state === 'SCORED' ? `score ${String(c.score ?? '—')}` : 'insufficient data'} under ${c.modelVersion}`
      }
      case 'SIMILARITY_PAIR': {
        const c = parseCaptured('SIMILARITY_PAIR', row.captured)
        return `${c.band}${c.distance === null ? '' : ` · distance ${String(c.distance)}`}`
      }
      case 'RESEARCH_PRODUCT': {
        const c = parseCaptured('RESEARCH_PRODUCT', row.captured)
        return `${c.title ?? row.evidence_id} · ${c.sourceSlug}`
      }
      case 'RESEARCH_NOTE': {
        const c = parseCaptured('RESEARCH_NOTE', row.captured)
        return `“${c.excerpt.slice(0, 80)}${c.excerpt.length > 80 ? '…' : ''}”`
      }
      case 'MEDIA_ASSET': {
        const c = parseCaptured('MEDIA_ASSET', row.captured)
        return `${c.rivyaAssetId ?? c.publicId} (concept)`
      }
      default:
        return row.evidence_id
    }
  } catch {
    return row.evidence_id
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ briefId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('research.read')
  const { briefId } = await params
  const query = await searchParams
  if (!/^[0-9a-f-]{36}$/u.test(briefId)) notFound()
  const client = await createClient()
  const brief = await getDirectionBrief(client, briefId)
  if (brief === null) notFound()

  const canWrite = roleHasPermission(session.role, 'research.direction.write')
  const canApprove = roleHasPermission(session.role, 'research.direction.approve')
  const [evidence, revisions] = await Promise.all([
    listBriefEvidence(client, brief.id),
    listBriefRevisions(client, brief.id, 25),
  ])

  // Drift and figures, from the captured values beside the current ones.
  const figures: (ObservedFigure & { capturedAt: string })[] = []
  const views: EvidenceView[] = []
  for (const row of evidence) {
    let drift: EvidenceView['drift'] = null
    if (row.evidence_type === 'OPPORTUNITY_SCORE') {
      try {
        const captured = parseCaptured('OPPORTUNITY_SCORE', row.captured)
        const current = await newestScoreForProduct(client, captured.researchProductId)
        const result = scoreDrift(
          captured,
          current === null
            ? null
            : {
                researchProductId: current.research_product_id,
                score: current.score,
                confidence: Number(current.confidence),
                completeness: Number(current.completeness),
                state: current.state,
                modelVersion: current.model_version,
                computedAt: current.computed_at,
              },
        )
        drift = {
          changed: result.changed,
          current:
            result.current === null
              ? null
              : `${result.current.state === 'SCORED' ? `score ${String(result.current.score ?? '—')}` : 'insufficient data'} under ${result.current.modelVersion}`,
        }
      } catch {
        drift = null
      }
    } else if (row.evidence_type === 'ANALYTICS_SNAPSHOT') {
      try {
        const captured = parseCaptured('ANALYTICS_SNAPSHOT', row.captured)
        const newest = await newestSnapshotLike(client, {
          scope_type: captured.scopeType,
          scope_id: null,
          metric_family: captured.metricFamily,
          currency: captured.currency,
        })
        const changed = snapshotDrift(captured, newest?.computed_at ?? null)
        drift = { changed, current: newest === null ? null : newest.computed_at.slice(0, 10) }
        for (const figure of captured.figures)
          figures.push({ ...figure, capturedAt: row.created_at })
      } catch {
        drift = null
      }
    }
    views.push({
      id: row.id,
      type: row.evidence_type,
      label: labelFor(row),
      rationale: row.rationale,
      capturedAt: row.created_at,
      drift,
    })
  }

  if (query.view === 'print') {
    return (
      <article className="brief-print" data-brief-print="">
        <p className="brief-print__header">{INTERNAL_DOCUMENT_HEADER}</p>
        <Heading level={1} size="display-md">
          {brief.title}
        </Heading>
        <p>
          {`${brief.status} · ${brief.target_category_slug ?? t('studio.research.dirCategoryNone')} · ${brief.updated_at.slice(0, 10)}`}
        </p>
        <p className="brief-print__no-print">
          <Link href={`${BASE}/${brief.id}` as Route}>{t('studio.research.dirBack')}</Link>
        </p>
        <h2>{t('studio.research.dirIntended')}</h2>
        {BRIEF_SECTIONS.map((section) => (
          <section key={section} className="brief-print__section">
            <h3>{SECTION_TITLES[section]}</h3>
            <p>{brief[section] ?? `(${t('studio.research.dirNotWritten')})`}</p>
          </section>
        ))}
        <h2>{`${t('studio.research.dirObservedHeading')} (${OBSERVED_LABEL})`}</h2>
        {figures.length === 0 ? (
          <p>{t('studio.research.dirObservedEmpty')}</p>
        ) : (
          <table className="brief-print__observed">
            <thead>
              <tr>
                <th scope="col">Figure</th>
                <th scope="col">Value</th>
                <th scope="col">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {figures.map((figure) => (
                <tr key={`${figure.capturedAt} ${figure.key}`}>
                  <td>{figure.label}</td>
                  <td>{formatFigure(figure)}</td>
                  <td>{`${String(figure.coverage.n)} of ${String(figure.coverage.denominator)} (${String(figure.coverage.coveragePct)} %) — ${OBSERVED_LABEL}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h2>{t('studio.research.dirEvidenceHeading')}</h2>
        <ul>
          {views.map((item) => (
            <li key={item.id}>{`${item.type} — ${item.label}. ${item.rationale}`}</li>
          ))}
        </ul>
        <p className="brief-print__footer">{t('studio.research.dirBanner')}</p>
      </article>
    )
  }

  const [sets, snapshots, scores, mood] = canWrite
    ? await Promise.all([
        listComparisonSetRefs(client),
        listRecentSnapshotRefs(client, 30),
        listRecentScoreRefs(client, 50),
        listMoodAssets(client),
      ])
    : [[], [], [], []]
  const groups: AttachGroup[] = [
    {
      type: 'COMPARISON_SET',
      label: 'Comparison sets',
      options: sets.map((set) => ({ value: set.id, label: set.name })),
    },
    {
      type: 'ANALYTICS_SNAPSHOT',
      label: 'Analytics snapshots',
      options: snapshots.map((snapshot) => ({
        value: snapshot.id,
        label: `${snapshot.metric_family}${snapshot.currency === null ? '' : ` ${snapshot.currency}`} · ${snapshot.scope_type} · ${snapshot.computed_at.slice(0, 10)}`,
      })),
    },
    {
      type: 'OPPORTUNITY_SCORE',
      label: 'Opportunity scores',
      options: scores.map((score) => ({
        value: score.id,
        label: `${score.title ?? score.research_product_id} · ${String(score.score ?? '—')} under ${score.model_version}`,
      })),
    },
    {
      type: 'MEDIA_ASSET',
      label: 'Concept media (mood)',
      options: mood.map((asset) => ({
        value: asset.id,
        label: asset.rivya_asset_id ?? asset.public_id,
      })),
    },
  ].filter((group) => group.options.length > 0) as AttachGroup[]

  const dialogLabels = {
    cancel: t('studio.content.section.cancelLabel'),
    close: t('studio.content.section.closeLabel'),
  }

  return (
    <StudioPage path="/studio/research/opportunities/direction">
      <Stack gap={6}>
        <Surface level={1} className="p-6" data-brief-header={brief.id}>
          <Stack gap={3}>
            <Text size="xs" tone="secondary" data-direction-banner="">
              {t('studio.research.dirBanner')}
            </Text>
            <Cluster gap={3}>
              <Heading level={2} size="display-sm">
                {brief.title}
              </Heading>
              <StatusPill status={brief.status} />
              <Badge tone="neutral" data-brief-category="">
                {`${t('studio.research.dirCategory')}: ${brief.target_category_slug ?? t('studio.research.dirCategoryNone')}`}
              </Badge>
              {brief.approved_at === null ? null : (
                <Badge tone="info" data-brief-approved="">
                  {`${t('studio.research.dirColApproved')} ${brief.approved_at.slice(0, 10)}`}
                </Badge>
              )}
            </Cluster>
            <Cluster gap={2}>
              <Link
                href={`${BASE}/${brief.id}?view=print` as Route}
                className="underline"
                data-brief-print-link=""
              >
                <Text size="sm" as="span">
                  {t('studio.research.dirPrint')}
                </Text>
              </Link>
              {canWrite && brief.status === 'DRAFT' ? (
                <form action={setBriefStatusFormAction} className="contents">
                  <input type="hidden" name="brief_id" value={brief.id} />
                  <input type="hidden" name="status" value="REVIEW" />
                  <Button type="submit" variant="secondary" size="sm" data-brief-to-review="">
                    {t('studio.research.dirStatusReview')}
                  </Button>
                </form>
              ) : null}
              {canWrite && (brief.status === 'REVIEW' || brief.status === 'APPROVED') ? (
                <form action={setBriefStatusFormAction} className="contents">
                  <input type="hidden" name="brief_id" value={brief.id} />
                  <input type="hidden" name="status" value="DRAFT" />
                  <Button type="submit" variant="secondary" size="sm" data-brief-to-draft="">
                    {t('studio.research.dirStatusDraft')}
                  </Button>
                </form>
              ) : null}
              {canApprove && brief.status === 'REVIEW' ? (
                <BriefStatusButton
                  briefId={brief.id}
                  status="APPROVED"
                  action={setBriefStatusFormAction}
                  variant="primary"
                  labels={{
                    button: t('studio.research.dirApprove'),
                    title: t('studio.research.dirApproveTitle'),
                    body: t('studio.research.dirApproveBody'),
                    confirm: t('studio.research.dirApprove'),
                    ...dialogLabels,
                  }}
                />
              ) : null}
              {canWrite && brief.status !== 'ARCHIVED' ? (
                <BriefStatusButton
                  briefId={brief.id}
                  status="ARCHIVED"
                  action={setBriefStatusFormAction}
                  labels={{
                    button: t('studio.research.dirArchive'),
                    title: t('studio.research.dirArchiveTitle'),
                    body: t('studio.research.dirArchiveBody'),
                    confirm: t('studio.research.dirArchive'),
                    ...dialogLabels,
                  }}
                />
              ) : null}
            </Cluster>
          </Stack>
        </Surface>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Surface level={1} className="p-6" data-brief-sections="">
              <Stack gap={4}>
                <Stack gap={1}>
                  <Heading level={2} size="display-xs">
                    {t('studio.research.dirIntended')}
                  </Heading>
                  <Text size="xs" tone="secondary">
                    {t('studio.research.dirIntendedHelp')}
                  </Text>
                </Stack>
                {canWrite && brief.status !== 'ARCHIVED' ? (
                  <ActionForm action={saveBriefAction}>
                    <input type="hidden" name="brief_id" value={brief.id} />
                    <Stack gap={4}>
                      <Cluster gap={3} align="end">
                        <label className="flex min-w-72 flex-col gap-1">
                          <Text size="xs" tone="secondary" as="span">
                            {t('studio.research.dirTitle')}
                          </Text>
                          <Input name="title" defaultValue={brief.title} required />
                        </label>
                        <label className="flex min-w-56 flex-col gap-1">
                          <Text size="xs" tone="secondary" as="span">
                            {t('studio.research.dirCategory')}
                          </Text>
                          <Select
                            name="target_category_slug"
                            defaultValue={brief.target_category_slug ?? ''}
                          >
                            <option value="">{t('studio.research.dirCategoryNone')}</option>
                            {D3_CATEGORY_SLUGS.map((slug) => (
                              <option key={slug} value={slug}>
                                {slug}
                              </option>
                            ))}
                          </Select>
                        </label>
                      </Cluster>
                      {BRIEF_SECTIONS.map((section) => (
                        <label
                          key={section}
                          className="flex flex-col gap-1"
                          data-brief-section={section}
                        >
                          <Text size="sm" as="span">
                            {t(SECTION_LABEL[section])}
                          </Text>
                          <Text size="xs" tone="secondary" as="span">
                            {t(SECTION_HELP[section])}
                          </Text>
                          <Textarea name={section} rows={4} defaultValue={brief[section] ?? ''} />
                        </label>
                      ))}
                      <div>
                        <Button type="submit" variant="primary" data-save-brief="">
                          {t('studio.research.dirSave')}
                        </Button>
                      </div>
                    </Stack>
                  </ActionForm>
                ) : (
                  <Stack gap={3}>
                    {BRIEF_SECTIONS.map((section) => (
                      <Stack key={section} gap={1} data-brief-section={section}>
                        <Text size="sm" as="span">
                          {t(SECTION_LABEL[section])}
                        </Text>
                        <Text size="sm" tone="secondary">
                          {brief[section] ?? `(${t('studio.research.dirNotWritten')})`}
                        </Text>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Surface>
          </div>

          <Stack gap={6}>
            <EvidenceRail
              briefId={brief.id}
              evidence={views}
              groups={groups}
              canWrite={canWrite && brief.status !== 'ARCHIVED'}
              actions={{ attach: attachEvidenceAction, detach: detachEvidenceFormAction }}
            />
            <ObservedFigures figures={figures} />
            <Surface level={1} className="p-6" data-brief-revisions="">
              <Stack gap={3}>
                <Heading level={2} size="display-xs">
                  {t('studio.research.dirRevisionsHeading')}
                </Heading>
                <Text size="xs" tone="secondary">
                  {t('studio.research.dirRevisionsHelp')}
                </Text>
                <ul className="m-0 list-none p-0">
                  {revisions.map((revision) => (
                    <li
                      key={revision.id}
                      className="border-line flex flex-wrap items-center gap-2 border-t py-2"
                      data-brief-revision={String(revision.revision)}
                    >
                      <Badge tone="neutral">{`#${String(revision.revision)}`}</Badge>
                      <Text size="xs" as="span" tone="secondary">
                        {`${revision.action} · ${revision.created_at.slice(0, 16).replace('T', ' ')}`}
                      </Text>
                      {canWrite && brief.status !== 'ARCHIVED' ? (
                        <form action={restoreRevisionFormAction} className="contents">
                          <input type="hidden" name="brief_id" value={brief.id} />
                          <input type="hidden" name="revision" value={String(revision.revision)} />
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            data-restore-revision=""
                          >
                            {t('studio.research.dirRestore')}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Stack>
            </Surface>
          </Stack>
        </div>
      </Stack>
    </StudioPage>
  )
}
