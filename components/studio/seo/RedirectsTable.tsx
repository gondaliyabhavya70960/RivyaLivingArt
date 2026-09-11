import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable } from '@/components/studio/DataTable'
import { SelectField, TextField } from '@/components/studio/FormField'
import type { StudioFormAction } from '@/components/studio/form-state'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import { chainedRedirects, normaliseRedirectPath } from '@/lib/seo/redirect-rules'
import type { SeoRedirect } from '@/lib/supabase/schemas/seo'

/**
 * RC-351 `RedirectsTable` — list, add, pause, resume, delete, and test a path.
 *
 * THE TEST IS A GET FORM: `?tab=redirects&test=/old-path` asks the same table the 404 path asks,
 * and the answer is printed rather than followed. Chain warnings come from `chainedRedirects()`,
 * which is empty on a table every write of which went through the Server Action; a warning here
 * means somebody wrote a row by hand.
 */
export function RedirectsTable({
  redirects,
  test,
  saveAction,
  statusAction,
  deleteAction,
  canWrite,
}: {
  readonly redirects: readonly SeoRedirect[]
  /** `?test=` — a path to look up, or null. */
  readonly test: string | null
  readonly saveAction: StudioFormAction
  readonly statusAction: StudioFormAction
  readonly deleteAction: StudioFormAction
  readonly canWrite: boolean
}) {
  const chained = new Set(chainedRedirects(redirects).map((row) => row.from_path))
  const tested =
    test === null
      ? null
      : (redirects.find(
          (row) => row.from_path === normaliseRedirectPath(test) && row.status === 'PUBLISHED',
        ) ?? null)

  return (
    <Stack gap={4} data-seo-redirects="">
      <Text size="sm" tone="secondary">
        {t('studio.seo.redirects.intro')}
      </Text>

      <Surface level={1} className="grid gap-3 p-4">
        <form method="get" action="/studio/content/seo" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="redirects" />
          <TextField
            name="test"
            label={t('studio.seo.redirects.testLabel')}
            defaultValue={test ?? ''}
          />
          <Button type="submit" size="sm" variant="secondary" data-seo-redirect-test="">
            {t('studio.seo.redirects.testButton')}
          </Button>
        </form>
        {test === null ? null : (
          <Text size="sm" data-seo-redirect-result={tested === null ? 'none' : 'found'}>
            {tested === null
              ? t('studio.seo.redirects.testNone')
              : t('studio.seo.redirects.testFound')
                  .replace('{{to}}', tested.to_path)
                  .replace('{{code}}', String(tested.status_code))}
          </Text>
        )}
      </Surface>

      <DataTable
        caption={t('studio.seo.redirects.caption')}
        rows={redirects}
        rowKey={(row) => row.id}
        empty={{
          reason: 'empty',
          heading: t('studio.seo.redirects.emptyHeading'),
          body: t('studio.seo.redirects.emptyBody'),
        }}
        columns={[
          {
            id: 'from',
            header: t('studio.seo.redirects.colFrom'),
            cell: (row) => (
              <span className="grid">
                <Text as="span" size="sm">
                  {row.from_path}
                </Text>
                {chained.has(row.from_path) ? (
                  <Text as="span" size="xs" tone="primary" data-seo-redirect-chain="">
                    {t('studio.seo.redirects.chainWarning')}
                  </Text>
                ) : null}
              </span>
            ),
          },
          { id: 'to', header: t('studio.seo.redirects.colTo'), cell: (row) => row.to_path },
          {
            id: 'code',
            header: t('studio.seo.redirects.colCode'),
            cell: (row) => String(row.status_code),
            numeric: true,
          },
          {
            id: 'hits',
            header: t('studio.seo.redirects.colHits'),
            cell: (row) => (
              <span className="grid text-right">
                <span>{String(row.hit_count)}</span>
                {row.last_hit_at === null ? null : (
                  <Text as="span" size="xs" tone="tertiary">
                    <RelativeTime value={row.last_hit_at} />
                  </Text>
                )}
              </span>
            ),
            numeric: true,
          },
          {
            id: 'status',
            header: t('studio.seo.col.status'),
            cell: (row) => <StatusPill status={row.status} />,
          },
          {
            id: 'actions',
            header: t('studio.seo.redirects.colActions'),
            cell: (row) =>
              canWrite ? (
                <span className="flex flex-wrap gap-2">
                  <ActionForm action={statusAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={row.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'}
                    />
                    <Button type="submit" size="sm" variant="secondary" data-seo-redirect-toggle="">
                      {row.status === 'PUBLISHED'
                        ? t('studio.seo.redirects.pause')
                        : t('studio.seo.redirects.resume')}
                    </Button>
                  </ActionForm>
                  <ActionForm action={deleteAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <Button type="submit" size="sm" variant="secondary" data-seo-redirect-delete="">
                      {t('studio.seo.redirects.delete')}
                    </Button>
                  </ActionForm>
                </span>
              ) : null,
          },
        ]}
      />

      {canWrite ? (
        <Surface level={1} className="grid gap-3 p-4">
          <Text size="sm">{t('studio.seo.redirects.addHeading')}</Text>
          <ActionForm action={saveAction} className="grid gap-3 md:grid-cols-2">
            <TextField
              name="from_path"
              label={t('studio.seo.redirects.from')}
              help={t('studio.seo.redirects.fromHelp')}
              required
              requiredLabel={t('studio.seo.requiredLabel')}
            />
            <TextField
              name="to_path"
              label={t('studio.seo.redirects.to')}
              required
              requiredLabel={t('studio.seo.requiredLabel')}
            />
            <SelectField
              name="status_code"
              label={t('studio.seo.redirects.code')}
              help={t('studio.seo.redirects.codeHelp')}
              defaultValue="308"
              options={[
                { value: '308', label: '308' },
                { value: '301', label: '301' },
              ]}
            />
            <TextField name="reason" label={t('studio.seo.redirects.reason')} />
            <div>
              <Button type="submit" size="sm" data-seo-redirect-add="">
                {t('studio.seo.redirects.add')}
              </Button>
            </div>
          </ActionForm>
        </Surface>
      ) : null}
    </Stack>
  )
}
