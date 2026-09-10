import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'

/**
 * What each adapter did to each source in one run — the visible half of FEAT §27's isolation claim.
 *
 * ONE PANEL PER SOURCE, AND THAT IS THE ARGUMENT. "A broken source adapter must not break other
 * sources" is a claim about what happens when something throws, and a claim about failure is only
 * checkable if the failure is recorded somewhere a person can look. A single run-level error count
 * would show a number and hide the thing worth knowing: which source stopped, and that the others
 * did not.
 *
 * `ABORTED` IS TONED AS A WARNING AND NOT AS A FAILURE, and the note beside it says why. Ten items
 * in a row failed and this source stopped for the rest of the run — which is the isolation working
 * rather than the run breaking, and a red badge would teach the opposite. `FAILED` is danger: the
 * adapter could not be resolved or started at all, so nothing about that source was read.
 *
 * FIVE ERRORS, NOT ALL OF THEM, and the copy states the count is exact. A broken adapter fails
 * every page it meets; four hundred identical stack traces would make this screen unreadable while
 * telling an operator nothing the first five did not.
 */

export interface AdapterRunRow {
  readonly id: string
  readonly source_id: string
  readonly adapter_key: string
  readonly adapter_version: string
  readonly status: string
  readonly items_seen: number
  readonly items_extracted: number
  readonly items_failed: number
  readonly first_errors: unknown
  readonly duration_ms: number
}

/** One recorded error. The shape `recordAdapterItem` appends; anything else renders as its text. */
interface AdapterError {
  readonly url?: string
  readonly message?: string
}

function readErrors(value: unknown): readonly AdapterError[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 5).map((entry) => {
    if (typeof entry === 'string') return { message: entry }
    if (typeof entry === 'object' && entry !== null) {
      const record = entry as Record<string, unknown>
      return {
        url: typeof record['url'] === 'string' ? record['url'] : undefined,
        message: typeof record['message'] === 'string' ? record['message'] : undefined,
      }
    }
    return { message: String(entry) }
  })
}

function toneFor(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'FAILED') return 'danger'
  if (status === 'ABORTED') return 'warning'
  if (status === 'PARTIAL') return 'warning'
  if (status === 'OK') return 'success'
  return 'neutral'
}

export function AdapterRunPanel({
  adapterRuns,
  sourceNames,
}: {
  readonly adapterRuns: readonly AdapterRunRow[]
  /** Source id → name, so a panel is headed by a source rather than by a uuid. */
  readonly sourceNames: ReadonlyMap<string, string>
}) {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.adaptersHeading')} />
        <Text tone="secondary">{t('studio.research.adaptersBody')}</Text>

        {adapterRuns.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noAdapterRuns')}
            body={t('studio.research.noAdapterRunsBody')}
          />
        ) : (
          <Stack gap={5}>
            {adapterRuns.map((row) => {
              const errors = readErrors(row.first_errors)
              return (
                <Surface
                  level={2}
                  className="p-4"
                  key={row.id}
                  data-adapter-run={row.id}
                  data-adapter-status={row.status}
                  data-adapter-source={row.source_id}
                >
                  <Stack gap={3}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Text as="span" className="flex-1">
                        {sourceNames.get(row.source_id) ?? row.source_id.slice(0, 8)}
                      </Text>
                      <Text as="span" size="xs" tone="tertiary" className="font-mono">
                        {`${row.adapter_key} · ${row.adapter_version}`}
                      </Text>
                      <Badge tone={toneFor(row.status)}>{row.status}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Badge tone="neutral" data-items-seen={String(row.items_seen)}>
                        {`${t('studio.research.itemsSeen')}: ${row.items_seen}`}
                      </Badge>
                      <Badge tone="neutral" data-items-extracted={String(row.items_extracted)}>
                        {`${t('studio.research.itemsExtracted')}: ${row.items_extracted}`}
                      </Badge>
                      <Badge
                        tone={row.items_failed > 0 ? 'warning' : 'neutral'}
                        data-items-failed={String(row.items_failed)}
                      >
                        {`${t('studio.research.itemsFailed')}: ${row.items_failed}`}
                      </Badge>
                    </div>

                    {row.status === 'ABORTED' ? (
                      <Text tone="secondary" size="sm" data-aborted-note="">
                        {t('studio.research.abortedNote')}
                      </Text>
                    ) : null}

                    {errors.length === 0 ? null : (
                      <Stack gap={2}>
                        <Text size="sm" tone="tertiary">
                          {t('studio.research.firstErrors')}
                        </Text>
                        <ul className="list-none" data-first-errors="">
                          {errors.map((error, index) => (
                            <li
                              key={`${row.id}:${String(index)}`}
                              className="border-line border-t py-2"
                            >
                              {error.url === undefined ? null : (
                                <Text size="xs" tone="tertiary" className="font-mono break-all">
                                  {error.url}
                                </Text>
                              )}
                              <Text size="sm" tone="secondary">
                                {error.message ?? '—'}
                              </Text>
                            </li>
                          ))}
                        </ul>
                        <Text size="xs" tone="tertiary">
                          {t('studio.research.firstErrorsBody')}
                        </Text>
                      </Stack>
                    )}
                  </Stack>
                </Surface>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Surface>
  )
}
