import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable } from '@/components/studio/DataTable'
import { SelectField, TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listArticlesForStudio, listCategories } from '@/lib/supabase/repositories/journal'
import { createClient } from '@/lib/supabase/server'
import type { JournalArticle } from '@/lib/supabase/schemas'

import { createArticleAction } from './actions'

/**
 * /studio/content/journal — the article list.
 *
 * THE BODY COLUMN IS THE ONE WORTH HAVING. Ten articles exist as a title and an angle, and the
 * question an editor opens this screen with is which of them has anything written in it —
 * `enforce_article_has_body` refuses to publish one that does not, so an empty body is the blocker
 * they will meet. It reads `page_id`, which is the same thing the trigger checks.
 *
 * "APPEARS ON" RATHER THAN "PUBLISHED AT", because a date in the future is a schedule rather than
 * history: the public read is gated on `published_at <= now()`, so an article published with
 * tomorrow's date is invisible until tomorrow, and a column headed "published" would read as
 * though it already were.
 */
export const metadata = studioMetadata('/studio/content/journal')

export default async function Page() {
  const session = await requirePermission('content.read')
  const client = await createClient()
  const [articles, categories] = await Promise.all([
    listArticlesForStudio(client),
    listCategories(client),
  ])

  const canWrite = roleHasPermission(session.role, 'content.write')
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))

  return (
    <StudioPage path="/studio/content/journal">
      <Stack gap={8}>
        <Text size="sm" tone="secondary">
          {t('studio.journal.caption')}
        </Text>

        <Link
          href={'/studio/content/journal/categories' as Route}
          className="underline underline-offset-4"
        >
          <Text size="sm" as="span">
            {t('studio.journal.categoriesHeading')}
          </Text>
        </Link>

        <DataTable<JournalArticle>
          caption={t('studio.journal.caption')}
          rows={articles}
          rowKey={(article) => article.id}
          empty={{
            reason: 'empty',
            heading: t('studio.journal.emptyHeading'),
            body: t('studio.journal.emptyBody'),
          }}
          columns={[
            {
              id: 'title',
              header: t('studio.journal.colTitle'),
              cell: (article) => (
                <Link
                  href={`/studio/content/journal/${article.id}` as Route}
                  className="underline underline-offset-4"
                  data-article-link={article.id}
                >
                  {article.title === '' ? t('studio.journal.untitled') : article.title}
                </Link>
              ),
            },
            {
              id: 'category',
              header: t('studio.journal.colCategory'),
              cell: (article) =>
                article.primary_category_id === null
                  ? t('studio.journal.noCategory')
                  : (categoryNames.get(article.primary_category_id) ??
                    t('studio.journal.noCategory')),
            },
            {
              id: 'body',
              header: t('studio.journal.colBody'),
              cell: (article) =>
                article.page_id === null
                  ? t('studio.journal.bodyAbsent')
                  : t('studio.journal.bodyPresent'),
            },
            {
              id: 'published',
              header: t('studio.journal.colPublished'),
              cell: (article) =>
                article.published_at === null ? '—' : <RelativeTime value={article.published_at} />,
            },
            {
              id: 'status',
              header: t('studio.journal.colStatus'),
              cell: (article) => <StatusPill status={article.status} />,
            },
          ]}
        />

        {canWrite ? (
          <>
            <Divider />
            <Stack gap={3}>
              <PageHeader level={2} title={t('studio.journal.newHeading')} />
              <HelpText>{t('studio.journal.newHelp')}</HelpText>
              <ActionForm action={createArticleAction} className="grid max-w-md gap-4">
                <TextField
                  name="title"
                  label={t('studio.journal.fieldTitle')}
                  required
                  requiredLabel={t('studio.journal.requiredLabel')}
                />
                <TextField
                  name="slug"
                  label={t('studio.journal.newSlug')}
                  required
                  requiredLabel={t('studio.journal.requiredLabel')}
                />
                <SelectField
                  name="primary_category_id"
                  label={t('studio.journal.fieldCategory')}
                  help={t('studio.journal.fieldCategoryHelp')}
                  options={[
                    { value: '', label: t('studio.journal.categoryNone') },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
                <div>
                  <Button type="submit">{t('studio.journal.newSubmit')}</Button>
                </div>
              </ActionForm>
            </Stack>
          </>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
