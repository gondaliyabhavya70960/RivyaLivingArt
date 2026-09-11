import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import type { StudioFormAction } from '@/components/studio/form-state'
import { VerificationPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import type { SeoKeywordTheme } from '@/lib/supabase/schemas/seo'
import { KEYWORD_STATUSES } from '@/lib/supabase/schemas/seo'

/**
 * RC-350 `KeywordsTable` — the SEED §42 themes as research targets: theme, mapped path, status,
 * notes and the evidence URL the owner pastes from whatever tool they used.
 *
 * NO NUMBER ANYWHERE ON THIS SURFACE. No volume, difficulty, CPC, rank or opportunity — the table
 * has no column for one (0370) and the form has no field for one. §42's caveat is printed above
 * the list, verbatim from `global_content`, because a list of keywords with statuses is exactly
 * the artefact that gets mistaken for a strategy.
 */
export function KeywordsTable({
  themes,
  saveAction,
  deleteAction,
  canWrite,
}: {
  readonly themes: readonly SeoKeywordTheme[]
  readonly saveAction: StudioFormAction
  readonly deleteAction: StudioFormAction
  readonly canWrite: boolean
}) {
  const statusOptions = KEYWORD_STATUSES.map((status) => ({ value: status, label: status }))
  return (
    <Stack gap={4} data-seo-keywords="">
      <Text size="sm" tone="secondary" data-seo-keywords-caveat="">
        {t('studio.seo.keywords.caveat')}
      </Text>
      <Text size="xs" tone="tertiary">
        {t('studio.seo.keywords.count').replace('{{count}}', String(themes.length))}
      </Text>

      <ul className="grid list-none gap-3 p-0">
        {themes.map((theme) => (
          <li key={theme.id}>
            <Surface level={1} className="grid gap-3 p-4" data-seo-keyword={theme.normalized_theme}>
              <div className="flex flex-wrap items-center gap-3">
                <Text size="md">{theme.theme}</Text>
                <Text as="span" size="xs" tone="tertiary" data-seo-keyword-status="">
                  {theme.research_status}
                </Text>
                <VerificationPill verification={theme.owner_verification} />
              </div>
              {theme.owner_verification === 'OWNER_VERIFICATION_REQUIRED' ? (
                <Text size="xs" tone="secondary">
                  {t('studio.seo.keywords.geographyNote')}
                </Text>
              ) : null}
              <ActionForm action={saveAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={theme.id} />
                <input type="hidden" name="theme" value={theme.theme} />
                <TextField
                  name="mapped_path"
                  label={t('studio.seo.keywords.mappedPath')}
                  defaultValue={theme.mapped_path ?? ''}
                />
                <SelectField
                  name="research_status"
                  label={t('studio.seo.keywords.status')}
                  defaultValue={theme.research_status}
                  options={statusOptions}
                />
                <TextField
                  name="evidence_url"
                  type="url"
                  label={t('studio.seo.keywords.evidence')}
                  help={t('studio.seo.keywords.evidenceHelp')}
                  defaultValue={theme.evidence_url ?? ''}
                />
                <TextAreaField
                  name="notes"
                  label={t('studio.seo.keywords.notes')}
                  defaultValue={theme.notes ?? ''}
                  rows={2}
                />
                {canWrite ? (
                  <div>
                    <Button type="submit" size="sm" data-seo-keyword-save="">
                      {t('studio.seo.keywords.save')}
                    </Button>
                  </div>
                ) : null}
              </ActionForm>
              {canWrite ? (
                <ActionForm action={deleteAction}>
                  <input type="hidden" name="id" value={theme.id} />
                  <Button type="submit" size="sm" variant="secondary" data-seo-keyword-delete="">
                    {t('studio.seo.keywords.remove')}
                  </Button>
                </ActionForm>
              ) : null}
            </Surface>
          </li>
        ))}
      </ul>

      {canWrite ? (
        <Surface level={1} className="grid gap-3 p-4">
          <Text size="sm">{t('studio.seo.keywords.addHeading')}</Text>
          <ActionForm action={saveAction} className="grid gap-3 md:grid-cols-2">
            <TextField
              name="theme"
              label={t('studio.seo.keywords.theme')}
              required
              requiredLabel={t('studio.seo.requiredLabel')}
            />
            <TextField name="mapped_path" label={t('studio.seo.keywords.mappedPath')} />
            <SelectField
              name="research_status"
              label={t('studio.seo.keywords.status')}
              defaultValue="UNRESEARCHED"
              options={statusOptions}
            />
            <TextField
              name="evidence_url"
              type="url"
              label={t('studio.seo.keywords.evidence')}
              help={t('studio.seo.keywords.evidenceHelp')}
            />
            <div>
              <Button type="submit" size="sm" data-seo-keyword-add="">
                {t('studio.seo.keywords.add')}
              </Button>
            </div>
          </ActionForm>
        </Surface>
      ) : null}
    </Stack>
  )
}
