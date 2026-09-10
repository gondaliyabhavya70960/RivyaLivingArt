import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'

/**
 * The pages a run actually read something new from, each openable beside what the adapter made of
 * it.
 *
 * THIS LIST IS SHORT ON PURPOSE AND THE COPY SAYS SO. A version exists only where the content hash
 * differed from the last one, so a nightly run over four hundred unchanged pages produces none —
 * and an operator who does not know that reads an empty list as a broken pipeline rather than as a
 * quiet night. Saying it in the empty state is cheaper than explaining it once a month.
 *
 * A `<details>` ELEMENT RATHER THAN A CLIENT DRAWER, and that is not a compromise. What the drawer
 * has to do is show one row's draft beside its provenance; a native disclosure does that, works
 * with JavaScript off, is keyboard-complete without a focus trap, and keeps this whole page a
 * Server Component. `components/patterns/Disclosure` exists for the cases that need controlled
 * state and this is not one.
 *
 * EVERY VALUE IS SHOWN AS THE OTHER SITE PUBLISHED IT. The heading says "as the page said it"
 * rather than "extracted data" because the difference is the entire design: nothing here has been
 * parsed, converted or interpreted, and a screen that implied otherwise would invite somebody to
 * read `"1.299,00 €"` as a number Rivya had understood.
 */

export interface VersionRow {
  readonly id: string
  readonly research_product_id: string
  readonly raw: unknown
  readonly content_hash: string
  readonly storage_key: string | null
  readonly adapter_key: string
  readonly adapter_version: string
  readonly observed_at: string
}

/** The draft fields worth listing, in the order somebody reads them. */
const SHOWN = [
  'title',
  'priceText',
  'currencyText',
  'skuText',
  'availabilityText',
  'leadTimeText',
  'canonicalUrl',
  'externalId',
] as const

const SHOWN_LISTS = [
  'dimensionTexts',
  'materialTexts',
  'variantTexts',
  'customizationTexts',
  'categoryLabels',
  'imageUrls',
] as const

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function list(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/** How many fields the adapter actually found, rather than defaulted. FEAT §27's `confidence`. */
function foundCount(raw: Record<string, unknown>): number {
  const confidence = record(raw['confidence'])
  return Object.values(confidence).filter((value) => value === 1).length
}

export function VersionList({ versions }: { readonly versions: readonly VersionRow[] }) {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.versionsHeading')} />
        <Text tone="secondary">{t('studio.research.versionsBody')}</Text>

        {versions.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noVersions')}
            body={t('studio.research.noVersionsBody')}
          />
        ) : (
          <Stack gap={3}>
            {versions.map((version) => {
              const raw = record(version.raw)
              const provenance = record(raw['provenance'])
              const found = foundCount(raw)
              return (
                <details
                  key={version.id}
                  className="border-line border"
                  data-version-id={version.id}
                  data-content-hash={version.content_hash.slice(0, 12)}
                >
                  <summary className="cursor-pointer p-3">
                    <span className="inline-flex flex-wrap items-center gap-3">
                      <Text as="span" size="sm">
                        {text(raw['title']) ?? text(raw['canonicalUrl']) ?? version.id.slice(0, 8)}
                      </Text>
                      <Text as="span" size="xs" tone="tertiary" className="font-mono">
                        {`${version.adapter_key} · ${version.adapter_version}`}
                      </Text>
                      {/* THREE IS FEAT §27's OWN THRESHOLD for `low_confidence_extraction`, and the
                          badge is a warning rather than a failure: a page that published little is
                          not a page that was read wrongly. */}
                      {found < 3 ? (
                        <Badge tone="warning" data-low-confidence="">
                          {t('studio.research.confidenceLow')}
                        </Badge>
                      ) : null}
                      <Text as="span" size="xs" tone="tertiary">
                        {version.observed_at.slice(0, 16).replace('T', ' ')}
                      </Text>
                    </span>
                  </summary>

                  <div className="border-line border-t p-3">
                    <Stack gap={3}>
                      <Text size="sm" tone="secondary">
                        {t('studio.research.draftBody')}
                      </Text>

                      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {SHOWN.map((field) => {
                          const value = text(raw[field])
                          if (value === null) return null
                          return (
                            <div key={field} data-draft-field={field}>
                              <dt>
                                <Text as="span" size="2xs" uppercase tone="tertiary">
                                  {field}
                                </Text>
                              </dt>
                              <dd>
                                <Text as="span" size="sm" className="break-all">
                                  {value}
                                </Text>
                                {typeof provenance[field] === 'string' ? (
                                  <Text as="span" size="xs" tone="tertiary" className="ml-2">
                                    {`${t('studio.research.provenance')} ${String(provenance[field])}`}
                                  </Text>
                                ) : null}
                              </dd>
                            </div>
                          )
                        })}
                      </dl>

                      {SHOWN_LISTS.map((field) => {
                        const values = list(raw[field])
                        if (values.length === 0) return null
                        return (
                          <div key={field} data-draft-list={field}>
                            <Text size="2xs" uppercase tone="tertiary">
                              {field}
                            </Text>
                            <ul className="list-none">
                              {values.slice(0, 12).map((value, index) => (
                                <li key={`${field}:${String(index)}`}>
                                  <Text size="sm" tone="secondary" className="break-all">
                                    {value}
                                  </Text>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}

                      {/* THE SNAPSHOT IS NAMED, NOT LINKED. It lives in a private bucket that has
                          no session-readable URL, and minting a signed one to decorate this screen
                          would publish a competitor's page body from a Rivya origin for as long as
                          the link lived. */}
                      <Text
                        size="xs"
                        tone="tertiary"
                        data-snapshot-state={version.storage_key === null ? 'PRUNED' : 'KEPT'}
                      >
                        {version.storage_key === null
                          ? t('studio.research.snapshotPruned')
                          : t('studio.research.snapshotKept')}
                      </Text>
                    </Stack>
                  </div>
                </details>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Surface>
  )
}
