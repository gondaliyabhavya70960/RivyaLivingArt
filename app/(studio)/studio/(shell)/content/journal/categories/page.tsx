import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { TextAreaField, TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listCategories } from '@/lib/supabase/repositories/journal'
import { createClient } from '@/lib/supabase/server'

import { saveCategoryAction } from '../actions'

/**
 * /studio/content/journal/categories — the nine subjects the journal is filed under.
 *
 * A NAME CAN CHANGE AND AN ADDRESS CANNOT, and this screen shows both so the difference is visible
 * rather than enforced silently. `journal_categories.slug` is a public URL —
 * `/journal/category/materials` — and changing one breaks every link anybody made to it. The
 * database allows the change deliberately: a slug move is legitimate once there is a redirect to go
 * with it, and redirects are Phase 39. Until then `saveCategoryAction` refuses, and the refusal
 * explains rather than the field silently ignoring what was typed.
 *
 * THERE IS NO CREATE AND NO DELETE. SEED §19 fixes the nine, they are seeded and owned by the
 * runner, and a tenth would be a taxonomy decision rather than an editorial one — it needs a seed
 * record so that every environment has it, not a row typed into one database. Deleting one would
 * orphan every article filed under it and 404 a URL that has been public.
 *
 * ORDER IS A NUMBER, as it is everywhere else in this Studio: the chip row and the category pages
 * both sort by it, and a number is reachable by keyboard in a way a drag handle is not.
 */
export const metadata = studioMetadata('/studio/content/journal')

export default async function Page() {
  const session = await requirePermission('content.read')
  const categories = await listCategories(await createClient())
  const canWrite = roleHasPermission(session.role, 'content.write')

  return (
    <StudioPage path="/studio/content/journal">
      <Stack gap={8}>
        <PageHeader level={1} title={t('studio.journal.categoriesHeading')} />
        <HelpText>{t('studio.journal.categoriesHelp')}</HelpText>

        <Link href={'/studio/content/journal' as Route} className="underline underline-offset-4">
          <Text size="sm" as="span">
            {t('studio.journal.backToList')}
          </Text>
        </Link>

        {categories.map((category) => (
          <div key={category.id} data-journal-category={category.slug}>
            <Divider />
            <ActionForm action={saveCategoryAction} className="grid max-w-2xl gap-4 pt-6">
              <input type="hidden" name="id" value={category.id} />
              {/*
                The current address travels with the form so the action can compare what came back
                against what it sent. A submitted slug that differs is refused with a sentence,
                rather than accepted and discarded — a field that takes a value and ignores it is
                worse than one that says no.
              */}
              <input type="hidden" name="current_slug" value={category.slug} />
              <TextField
                name="name"
                label={t('studio.journal.categoryName')}
                defaultValue={category.name}
                required
                requiredLabel={t('studio.journal.requiredLabel')}
              />
              <TextField
                name="slug"
                label={t('studio.journal.categorySlug')}
                defaultValue={category.slug}
              />
              <TextField
                name="intro_heading"
                label={t('studio.journal.categoryIntro')}
                defaultValue={category.intro_heading ?? ''}
              />
              <TextAreaField
                name="description"
                label={t('studio.journal.categoryDescription')}
                defaultValue={category.description ?? ''}
              />
              <TextField
                name="position"
                label={t('studio.journal.categoryPosition')}
                defaultValue={String(category.position)}
              />
              <div>
                <Button type="submit" disabled={!canWrite}>
                  {t('studio.journal.categorySave')}
                </Button>
              </div>
            </ActionForm>
          </div>
        ))}
      </Stack>
    </StudioPage>
  )
}
