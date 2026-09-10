import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import type { StudioFormAction } from '@/components/studio/form-state'
import type { TestedUrl } from '@/lib/scraper/core/url-patterns'

/**
 * Two controls that look alike and are not remotely alike, drawn together so the difference is
 * visible at the moment somebody chooses between them.
 *
 * THE TESTER MAKES NO REQUEST. It is a plain GET form that reloads this page with the URLs in the
 * query string; the answer is computed from the patterns already stored and from the robots file
 * already in the cache. That is the whole reason it exists — an operator can check twenty candidate
 * addresses against a source's configuration without a single packet reaching anybody, including
 * the twenty addresses that turn out to be disallowed.
 *
 * THE PROBE MAKES EXACTLY ONE. It is a POST to a Server Action that goes through the same fetcher
 * every scheduled run uses, so robots.txt, the source's delay and the circuit breaker all apply,
 * and it writes an audit row with the operator's name on it. The copy beside it says so before it
 * is pressed rather than afterwards.
 *
 * A GET RATHER THAN A SERVER ACTION FOR THE TESTER, deliberately. `StudioFormState` carries no
 * payload channel — it is idle, saved, or a list of issues — so an action returning twenty rows of
 * results would need a second state shape invented for one screen. A query string is also
 * shareable, which is exactly what somebody debugging a source wants to send to a colleague.
 */

export function PatternTester({
  sourceId,
  urlsValue,
  results,
  canProbe,
  probeAction,
}: {
  readonly sourceId: string
  readonly urlsValue: string
  readonly results: readonly TestedUrl[] | null
  readonly canProbe: boolean
  readonly probeAction: StudioFormAction
}) {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.testerHeading')} />
        <Text tone="secondary">{t('studio.research.testerBody')}</Text>

        {/* A GET, so no request is made and the result is a link somebody can share. */}
        <form method="get" data-pattern-tester="">
          <Stack gap={3}>
            <label className="flex flex-col gap-1">
              <Text size="sm" as="span">
                {t('studio.research.testerHeading')}
              </Text>
              <Textarea name="test" rows={6} defaultValue={urlsValue} className="font-mono" />
            </label>
            <div>
              <Button type="submit" variant="secondary">
                {t('studio.research.testerRun')}
              </Button>
            </div>
          </Stack>
        </form>

        {results === null ? null : (
          <div className="border-line overflow-x-auto border" data-tester-results="">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t('studio.research.testerHeading')}</caption>
              <thead className="bg-surface-raised">
                <tr>
                  <th scope="col" className="p-2 text-left">
                    URL
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.patternKind')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    robots.txt
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.probeHeading')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.url} className="border-line border-t" data-tested-url={row.url}>
                    <td className="p-2 font-mono text-xs">{row.url}</td>
                    <td className="p-2">
                      {row.match.kind === null ? (
                        <Text size="sm" tone="tertiary" as="span">
                          {row.match.reason === 'EXCLUDED' ? 'EXCLUDE' : '—'}
                        </Text>
                      ) : (
                        <Badge tone={row.match.kind === 'EXCLUDE' ? 'danger' : 'neutral'}>
                          {row.match.kind}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge tone={row.robots === 'DISALLOWED' ? 'danger' : 'neutral'}>
                        {row.robots}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Text size="sm" as="span" data-would-fetch={String(row.wouldFetch)}>
                        {row.wouldFetch ? 'yes' : 'no'}
                      </Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canProbe ? (
          <Stack gap={3}>
            <PageHeader level={3} title={t('studio.research.probeHeading')} />
            {/* SAID BEFORE THE BUTTON, NOT AFTER IT. This is the only control on the page that
                reaches somebody else's server. */}
            <Text tone="secondary">{t('studio.research.probeBody')}</Text>
            <ActionForm action={probeAction}>
              <Stack gap={3}>
                <input type="hidden" name="source_id" value={sourceId} />
                <label className="flex flex-col gap-1">
                  <Text size="sm" as="span">
                    URL
                  </Text>
                  <Input name="url" type="url" className="font-mono" />
                </label>
                <div>
                  <Button type="submit" variant="secondary">
                    {t('studio.research.probeRun')}
                  </Button>
                </div>
              </Stack>
            </ActionForm>
          </Stack>
        ) : null}
      </Stack>
    </Surface>
  )
}
