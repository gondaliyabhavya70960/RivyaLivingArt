import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import type { LexiconRow } from '@/lib/supabase/repositories/research/lexicon'

/**
 * The material vocabulary, edited as data.
 *
 * THIS EDITOR IS THE REASON THE LEXICON IS A TABLE. The first time a competitor lists a material
 * nobody anticipated, the fix should be somebody typing it here and running `research:renormalize`
 * — which re-reads every stored page with **no network traffic at all**, because the evidence is
 * already held. A hard-coded array would make the same fix a pull request, a review and a release,
 * so it would not happen, and the field would read as unmatched for a year.
 *
 * NOTHING ON THIS SCREEN IS A CLAIM ABOUT WHAT RIVYA MAKES. These are words to recognise on other
 * people's pages. No token here is rendered on a public surface, and the copy says so, because a
 * screen listing forty materials inside a furniture maker's admin is otherwise read as a list of
 * what they work in.
 *
 * DISABLING IS OFFERED BESIDE DELETING, AND THE ORDER MATTERS. A term somebody wants to stop
 * matching should be disabled — the row and its history stay, and re-enabling is one click.
 * Deleting is for a term typed in error. Offering only the delete would push people towards it for
 * both.
 */

export function LexiconEditor({
  entries,
  canWrite,
  canDelete,
  saveAction,
  deleteAction,
}: {
  readonly entries: readonly LexiconRow[]
  readonly canWrite: boolean
  readonly canDelete: boolean
  readonly saveAction: StudioFormAction
  readonly deleteAction: StudioFormAction
}) {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.lexiconHeading')} />
        <Text tone="secondary">{t('studio.research.lexiconBody')}</Text>

        {entries.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.lexiconHeading')}
            body={t('studio.research.lexiconBody')}
          />
        ) : (
          <div className="border-line overflow-x-auto border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t('studio.research.lexiconHeading')}</caption>
              <thead className="bg-surface-raised">
                <tr>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.lexiconToken')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.lexiconPatterns')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.lexiconFamily')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.lexiconEnabled')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    <span className="sr-only">{t('studio.research.remove')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-line border-t"
                    data-lexicon-token={entry.token}
                  >
                    <td className="p-2 font-mono">{entry.token}</td>
                    <td className="p-2">{entry.patterns.join(', ')}</td>
                    <td className="text-ink-secondary p-2">{entry.family ?? '—'}</td>
                    <td className="p-2" data-lexicon-enabled={entry.is_enabled ? 'true' : 'false'}>
                      {entry.is_enabled ? (
                        <Badge tone="success">{t('studio.research.lexiconEnabled')}</Badge>
                      ) : (
                        <Badge tone="neutral">{t('studio.research.dismissed')}</Badge>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {canWrite ? (
                        <Cluster gap={2} justify="end">
                          <ActionForm action={saveAction}>
                            <input type="hidden" name="id" value={entry.id} />
                            <input type="hidden" name="token" value={entry.token} />
                            <input
                              type="hidden"
                              name="patterns"
                              value={entry.patterns.join(', ')}
                            />
                            <input type="hidden" name="family" value={entry.family ?? ''} />
                            <input
                              type="hidden"
                              name="is_enabled"
                              value={entry.is_enabled ? 'off' : 'on'}
                            />
                            <Button type="submit" variant="quiet" size="sm">
                              {entry.is_enabled
                                ? t('studio.research.dismiss')
                                : t('studio.research.add')}
                            </Button>
                          </ActionForm>
                          {canDelete ? (
                            <ActionForm action={deleteAction}>
                              <input type="hidden" name="id" value={entry.id} />
                              <Button type="submit" variant="quiet" size="sm">
                                {t('studio.research.remove')}
                              </Button>
                            </ActionForm>
                          ) : null}
                        </Cluster>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite ? (
          <ActionForm action={saveAction}>
            <Stack gap={3}>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.lexiconToken')}
                </Text>
                {/* THE TOKEN SHAPE IS A DATABASE CHECK AND A SCHEMA RULE AND A HINT HERE. Three
                    places, because the value ends up in `material_tokens` on thousands of rows and
                    a token with a space in it would be unmatchable and unremovable. */}
                <Input name="token" className="font-mono" placeholder="mango_wood" />
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.lexiconPatterns')}
                </Text>
                <Input name="patterns" placeholder="mango wood, mangowood" />
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.lexiconFamily')}
                </Text>
                <Input name="family" placeholder="wood" />
              </label>
              <input type="hidden" name="is_enabled" value="on" />
              <Cluster gap={2}>
                <Button type="submit" variant="secondary" size="sm">
                  {t('studio.research.add')}
                </Button>
              </Cluster>
            </Stack>
          </ActionForm>
        ) : null}
      </Stack>
    </Surface>
  )
}
