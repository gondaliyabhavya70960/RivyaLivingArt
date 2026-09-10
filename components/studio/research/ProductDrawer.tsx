import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { TextLink } from '@/components/primitives/TextLink'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import type { ExplorerRow } from '@/lib/supabase/repositories/research/explorer'
import type { MatchCandidateRow } from '@/lib/supabase/repositories/research/match-candidates'
import type { ValidationIssueRow } from '@/lib/supabase/repositories/research/validation-issues'

import { ParseStatePill, formatMinor } from './ParseStatePill'

/**
 * One scraped row, with **what the page said beside what Rivya made of it**.
 *
 * THE TWO COLUMNS ARE THE POINT OF THE SCREEN AND THE REASON THE NORMALIZER STORES `sourceTexts`.
 * Every figure in every later comparison is a judgement about somebody else's words, and the only
 * way anybody can check a judgement is to see the words. A drawer that showed `INR 64000` and
 * nothing else would be asking to be believed; showing `"₹64,000"` beside it is showing the working.
 *
 * THE PROVENANCE STRATEGY IS THE THIRD COLUMN, and it is what makes a wrong value traceable to a
 * RULE rather than guessed at. "This price came from JSON-LD" and "this price came from a CSS
 * selector somebody typed" fail differently and are fixed in different places.
 *
 * A `<details>` RATHER THAN A CLIENT DRAWER, for `VersionList`'s reason: what this has to do is show
 * one row beside its evidence, and a native disclosure does that with no focus trap, no state and
 * no client bundle. The row is addressed by `?row=<id>` so a link to it is a link somebody can send.
 *
 * OVERRIDE CONTROLS ARE ABSENT FOR A ROLE THAT MAY NOT USE THEM, not disabled. A disabled control
 * tells somebody the action exists and they are not trusted with it, which is a worse answer than
 * a screen that simply does not offer it — and the Server Action checks the permission again
 * regardless, because a hidden control is not a security boundary.
 */

export interface DrawerVersion {
  readonly id: string
  readonly raw: unknown
  readonly normalized: unknown
  readonly normalizer_version: string | null
  readonly adapter_key: string
  readonly observed_at: string
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function list(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/** One line of the comparison: the page's words, Rivya's reading, and which rule produced it. */
function Comparison({
  field,
  raw,
  normalised,
  parseState,
  provenance,
  frozen,
}: {
  readonly field: string
  readonly raw: string | null
  readonly normalised: string | null
  readonly parseState?: string | null
  readonly provenance?: string | null
  readonly frozen?: boolean
}) {
  return (
    <div
      className="border-line grid grid-cols-1 gap-2 border-t py-2 sm:grid-cols-3"
      data-field={field}
    >
      <div>
        <Text size="2xs" uppercase tone="tertiary">
          {field}
        </Text>
        {provenance !== null && provenance !== undefined ? (
          <Text size="xs" tone="tertiary" data-provenance={provenance}>
            {`${t('studio.research.provenance')} ${provenance}`}
          </Text>
        ) : null}
      </div>
      <div data-raw-value="">
        <Text size="sm" tone="secondary" className="break-words">
          {raw ?? '—'}
        </Text>
      </div>
      <div data-normalised-value="">
        <Cluster gap={2}>
          <Text size="sm" className="break-words">
            {normalised ?? '—'}
          </Text>
          <ParseStatePill state={parseState ?? null} />
          {frozen === true ? <Badge tone="info">{t('studio.research.frozen')}</Badge> : null}
        </Cluster>
      </div>
    </div>
  )
}

const SEVERITY_TONE: Readonly<Record<string, 'danger' | 'warning' | 'neutral'>> = {
  ERROR: 'danger',
  WARNING: 'warning',
  INFO: 'neutral',
}

export function ProductDrawer({
  row,
  version,
  issues,
  candidates,
  sourceName,
  categoryName,
  canWrite,
  canConfirm,
  overrideAction,
  dismissAction,
  decideAction,
  clearDuplicateAction,
}: {
  readonly row: ExplorerRow
  readonly version: DrawerVersion | null
  readonly issues: readonly ValidationIssueRow[]
  readonly candidates: readonly MatchCandidateRow[]
  readonly sourceName: string
  readonly categoryName: string | null
  readonly canWrite: boolean
  readonly canConfirm: boolean
  readonly overrideAction: StudioFormAction
  readonly dismissAction: StudioFormAction
  readonly decideAction: StudioFormAction
  readonly clearDuplicateAction: StudioFormAction
}) {
  const raw = record(version?.raw)
  const provenance = record(raw['provenance'])
  const normalized = record(version?.normalized)
  const parseStates = record(normalized['parseStates'])
  const sourceTexts = record(normalized['sourceTexts'])
  const overrides = record(row.normalized_overrides)
  const frozen = new Set(Object.keys(overrides))

  const dimensions = record(row.dimensions_mm)
  const dimensionSummary = Object.entries(dimensions)
    .map(
      ([key, value]) =>
        `${key.replace(/_mm(_max)?$/u, (_m, max: string) => (max ? ' max' : ''))} ${String(value)} mm`,
    )
    .join(' · ')

  return (
    <Surface level={1} className="p-6" data-row-drawer={row.id}>
      <Stack gap={5}>
        <Stack gap={2}>
          <PageHeader
            level={2}
            title={row.title_normalized ?? row.source_url}
            description={sourceName}
          />
          <Cluster gap={2}>
            <Badge tone="neutral" data-stage={row.stage}>
              {row.stage}
            </Badge>
            {row.disposition === 'NONE' ? null : (
              <Badge tone="warning" data-disposition={row.disposition}>
                {row.disposition}
              </Badge>
            )}
            {categoryName === null ? (
              <Badge tone="warning" data-unmatched="">
                {t('studio.research.unmatched')}
              </Badge>
            ) : (
              <Badge tone="info" data-matched-category={row.matched_category_id ?? ''}>
                {`${categoryName}${row.match_method === null ? '' : ` · ${row.match_method}`}`}
              </Badge>
            )}
          </Cluster>
          {/* THE ADDRESS IS SHOWN AND NOT LINKED. Opening a competitor's page from Studio is a
              request nobody's politeness clock accounted for, made from whatever network the person
              is on. The URL is here to be read and copied. */}
          <Text
            size="xs"
            tone="tertiary"
            className="font-mono break-all"
            data-source-url={row.source_url}
          >
            {row.source_url}
          </Text>
        </Stack>

        <Stack gap={0}>
          <div className="hidden grid-cols-3 gap-2 pb-1 sm:grid">
            <Text size="2xs" uppercase tone="tertiary">
              {t('studio.research.filterStage')}
            </Text>
            <Text size="2xs" uppercase tone="tertiary">
              {t('studio.research.rawValue')}
            </Text>
            <Text size="2xs" uppercase tone="tertiary">
              {t('studio.research.normalisedValue')}
            </Text>
          </div>

          <Comparison
            field="title"
            raw={text(raw['title'])}
            normalised={row.title_normalized}
            parseState={text(parseStates['title'])}
            provenance={text(provenance['title'])}
            frozen={frozen.has('titleNormalized')}
          />
          <Comparison
            field="price"
            raw={text(sourceTexts['price']) ?? text(raw['priceText'])}
            normalised={
              formatMinor(row.price_min_minor, row.currency) ??
              (row.price_state === null ? null : row.price_state)
            }
            parseState={text(parseStates['price'])}
            provenance={text(provenance['priceText'])}
            frozen={frozen.has('priceMinMinor') || frozen.has('priceState')}
          />
          <Comparison
            field="currency"
            raw={text(raw['currencyText'])}
            normalised={row.currency}
            parseState={text(parseStates['currency'])}
            provenance={text(provenance['currencyText'])}
            frozen={frozen.has('currency')}
          />
          <Comparison
            field="dimensions"
            raw={
              list(sourceTexts['dimensions']).join(' · ') ||
              list(raw['dimensionTexts']).join(' · ') ||
              null
            }
            normalised={dimensionSummary === '' ? null : dimensionSummary}
            parseState={row.dimension_parse_state}
            provenance={text(provenance['dimensionTexts'])}
          />
          <Comparison
            field="materials"
            raw={
              list(sourceTexts['materials']).join(' · ') ||
              list(raw['materialTexts']).join(' · ') ||
              null
            }
            normalised={row.material_tokens.length === 0 ? null : row.material_tokens.join(', ')}
            parseState={text(parseStates['materials'])}
            provenance={text(provenance['materialTexts'])}
          />
          <Comparison
            field="availability"
            raw={text(sourceTexts['availability']) ?? text(raw['availabilityText'])}
            normalised={row.availability}
            parseState={text(parseStates['availability'])}
            provenance={text(provenance['availabilityText'])}
            frozen={frozen.has('availability')}
          />
        </Stack>

        {version === null ? null : (
          <Text
            size="xs"
            tone="tertiary"
            data-normalizer-version={version.normalizer_version ?? ''}
          >
            {`${version.adapter_key} · rules ${version.normalizer_version ?? '—'} · ${version.observed_at.slice(0, 16).replace('T', ' ')}`}
          </Text>
        )}

        {/* --- Findings ------------------------------------------------------------------- */}
        <Stack gap={3}>
          <PageHeader level={3} title={t('studio.research.issuesHeading')} />
          <Text tone="secondary" size="sm">
            {t('studio.research.issuesBody')}
          </Text>
          {issues.length === 0 ? (
            <EmptyState
              reason="empty"
              heading={t('studio.research.noIssues')}
              body={t('studio.research.noIssuesBody')}
            />
          ) : (
            <Stack gap={2}>
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="border-line border p-3"
                  data-issue-rule={issue.rule}
                  data-issue-severity={issue.severity}
                  data-issue-dismissed={issue.is_dismissed ? 'true' : 'false'}
                >
                  <Stack gap={2}>
                    <Cluster gap={2}>
                      <Badge tone={SEVERITY_TONE[issue.severity] ?? 'neutral'}>
                        {issue.severity}
                      </Badge>
                      <Text as="span" size="sm" className="font-mono">
                        {issue.rule}
                      </Text>
                      {issue.is_dismissed ? (
                        <Badge tone="neutral">{t('studio.research.dismissed')}</Badge>
                      ) : null}
                    </Cluster>
                    <Text size="sm" tone="secondary">
                      {issue.detail ?? ''}
                    </Text>
                    {issue.is_dismissed ? (
                      <Text size="xs" tone="tertiary">
                        {issue.dismiss_reason ?? ''}
                      </Text>
                    ) : canWrite ? (
                      <ActionForm action={dismissAction}>
                        <Cluster gap={2} align="end">
                          <input type="hidden" name="issue_id" value={issue.id} />
                          <label className="flex flex-1 flex-col gap-1">
                            <Text size="xs" as="span" tone="secondary">
                              {t('studio.research.dismissReason')}
                            </Text>
                            <Input name="reason" required />
                          </label>
                          <Button type="submit" variant="quiet" size="sm">
                            {t('studio.research.dismiss')}
                          </Button>
                        </Cluster>
                      </ActionForm>
                    ) : null}
                  </Stack>
                </div>
              ))}
            </Stack>
          )}
        </Stack>

        {/* --- Duplicates ---------------------------------------------------------------- */}
        {candidates.length === 0 && row.duplicate_of_id === null ? null : (
          <Stack gap={3}>
            <PageHeader level={3} title={t('studio.research.duplicateHeading')} />
            <Text tone="secondary" size="sm">
              {t('studio.research.duplicateBody')}
            </Text>

            {row.duplicate_of_id === null ? null : (
              <div className="border-line border p-3" data-duplicate-of={row.duplicate_of_id}>
                <Stack gap={2}>
                  <Text size="sm">
                    {`This row is held as a duplicate of ${row.duplicate_of_id}.`}
                  </Text>
                  {canConfirm ? (
                    <ActionForm action={clearDuplicateAction}>
                      <Cluster gap={2} align="end">
                        <input type="hidden" name="product_id" value={row.id} />
                        <label className="flex flex-1 flex-col gap-1">
                          <Text size="xs" as="span" tone="secondary">
                            {t('studio.research.dismissReason')}
                          </Text>
                          <Input name="reason" required />
                        </label>
                        <Button type="submit" variant="quiet" size="sm">
                          {t('studio.research.clearDuplicate')}
                        </Button>
                      </Cluster>
                    </ActionForm>
                  ) : null}
                </Stack>
              </div>
            )}

            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="border-line border p-3"
                data-candidate-id={candidate.id}
                data-candidate-decided={candidate.decided}
              >
                <Stack gap={2}>
                  <Cluster gap={2}>
                    <Badge tone="neutral">{candidate.method}</Badge>
                    <Text as="span" size="sm">
                      {`${String(Math.round(Number(candidate.score) * 100))}%`}
                    </Text>
                    <Text as="span" size="xs" tone="tertiary" className="font-mono break-all">
                      {candidate.candidate_id}
                    </Text>
                  </Cluster>
                  {candidate.decided === 'PENDING' && canConfirm ? (
                    <Cluster gap={2}>
                      <ActionForm action={decideAction}>
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <input type="hidden" name="decision" value="ACCEPTED" />
                        <Button type="submit" variant="secondary" size="sm">
                          {t('studio.research.accept')}
                        </Button>
                      </ActionForm>
                      <ActionForm action={decideAction}>
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <Button type="submit" variant="quiet" size="sm">
                          {t('studio.research.reject')}
                        </Button>
                      </ActionForm>
                    </Cluster>
                  ) : (
                    <Badge tone="neutral">{candidate.decided}</Badge>
                  )}
                </Stack>
              </div>
            ))}
          </Stack>
        )}

        {/* --- Override ------------------------------------------------------------------ */}
        {canWrite ? (
          <Stack gap={3}>
            <PageHeader level={3} title={t('studio.research.overrideHeading')} />
            <Text tone="secondary" size="sm">
              {t('studio.research.overrideBody')}
            </Text>
            <ActionForm action={overrideAction}>
              <Stack gap={3}>
                <input type="hidden" name="product_id" value={row.id} />
                <label className="flex flex-col gap-1">
                  <Text size="sm" as="span">
                    title
                  </Text>
                  <Input
                    name="title_normalized"
                    defaultValue=""
                    placeholder={row.title_normalized ?? ''}
                  />
                </label>
                <Cluster gap={3} align="end">
                  <label className="flex flex-col gap-1">
                    <Text size="sm" as="span">
                      price posture
                    </Text>
                    <Select name="price_state" defaultValue="">
                      <option value="">—</option>
                      <option value="FIXED">FIXED</option>
                      <option value="STARTING_FROM">STARTING_FROM</option>
                      <option value="REQUEST_QUOTE">REQUEST_QUOTE</option>
                      <option value="PRICE_ON_REQUEST">PRICE_ON_REQUEST</option>
                      <option value="UNKNOWN">UNKNOWN</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <Text size="sm" as="span">
                      currency
                    </Text>
                    <Input name="currency" maxLength={3} className="font-mono uppercase" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <Text size="sm" as="span">
                      price (minor units)
                    </Text>
                    <Input name="price_min_minor" inputMode="numeric" />
                  </label>
                </Cluster>
                <Cluster gap={3} align="end">
                  <label className="flex flex-col gap-1">
                    <Text size="sm" as="span">
                      availability
                    </Text>
                    <Select name="availability" defaultValue="">
                      <option value="">—</option>
                      <option value="IN_STOCK">IN_STOCK</option>
                      <option value="MADE_TO_ORDER">MADE_TO_ORDER</option>
                      <option value="PREORDER">PREORDER</option>
                      <option value="SOLD_OUT">SOLD_OUT</option>
                      <option value="UNKNOWN">UNKNOWN</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <Text size="sm" as="span">
                      lead time min (days)
                    </Text>
                    <Input name="lead_time_days_min" inputMode="numeric" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <Text size="sm" as="span">
                      lead time max (days)
                    </Text>
                    <Input name="lead_time_days_max" inputMode="numeric" />
                  </label>
                </Cluster>
                <Cluster gap={2}>
                  <Button type="submit" variant="secondary" size="sm">
                    {t('studio.research.save')}
                  </Button>
                  <TextLink href="/studio/research/explorer">
                    {t('studio.research.filterAll')}
                  </TextLink>
                </Cluster>
              </Stack>
            </ActionForm>
          </Stack>
        ) : null}
      </Stack>
    </Surface>
  )
}
