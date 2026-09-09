import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { DataTable } from '@/components/studio/DataTable'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill, VerificationPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import {
  countPartsByForm,
  listFormsForStudio,
} from '@/lib/supabase/repositories/customization-forms'
import { createClient } from '@/lib/supabase/server'
import type { CustomizationForm } from '@/lib/supabase/schemas'

import { createFormAction, duplicateFormAction } from './actions'

/**
 * /studio/catalog/customization-forms — the questions a bespoke brief asks.
 *
 * THE COUNTS ARE THE POINT OF THIS TABLE. A form's name says what it is for; the number of steps
 * and questions says whether it has been built. A row reading "0 steps, 0 questions" is a form
 * somebody created and left, and it is the single most useful thing this screen can show — which is
 * why the counts come from one grouped read rather than a query per row.
 *
 * KIND IS SHOWN AND NOT TRANSLATED. `FURNITURE`, `PRESERVATION`, `THREE_D_RESIN` and `CUSTOM` are
 * the enum values a merchandiser will also see in the database and in the seed files, and giving
 * them prettier names here would mean two vocabularies for one fact.
 *
 * NO DEMO BADGE ON THIS SCREEN. Migration 0180 marks demonstration CONTENT — products, pages,
 * articles, portfolio projects, testimonials — and a form is not content: the three seeded
 * templates are the studio's real brief structure, which the owner edits rather than replaces at
 * launch. Adding an `is_demo` column here would have implied they are placeholder.
 */
export const metadata = studioMetadata('/studio/catalog/customization-forms')

const KIND_OPTIONS = [
  { value: 'FURNITURE', label: 'FURNITURE' },
  { value: 'PRESERVATION', label: 'PRESERVATION' },
  { value: 'THREE_D_RESIN', label: 'THREE_D_RESIN' },
  { value: 'CUSTOM', label: 'CUSTOM' },
] as const

export default async function Page() {
  const session = await requirePermission('catalog.read')
  const client = await createClient()
  const [forms, counts] = await Promise.all([listFormsForStudio(client), countPartsByForm(client)])
  const canWrite = roleHasPermission(session.role, 'catalog.write')

  return (
    <StudioPage path="/studio/catalog/customization-forms">
      <Stack gap={8}>
        <HelpText>{t('studio.catalog.forms.help')}</HelpText>

        <DataTable<CustomizationForm>
          caption={t('studio.catalog.forms.caption')}
          rows={forms}
          rowKey={(form) => form.id}
          empty={{
            reason: 'empty',
            heading: t('studio.catalog.forms.emptyHeading'),
            body: t('studio.catalog.forms.emptyBody'),
          }}
          columns={[
            {
              id: 'name',
              header: t('studio.catalog.forms.colName'),
              cell: (form) => (
                <Link
                  href={`/studio/catalog/customization-forms/${form.id}` as Route}
                  className="underline underline-offset-4"
                >
                  {form.name}
                </Link>
              ),
            },
            {
              id: 'slug',
              header: t('studio.catalog.forms.colSlug'),
              cell: (form) => form.slug,
            },
            {
              id: 'kind',
              header: t('studio.catalog.forms.colKind'),
              cell: (form) => form.kind,
            },
            {
              id: 'steps',
              header: t('studio.catalog.forms.colSteps'),
              numeric: true,
              cell: (form) => counts.get(form.id)?.steps ?? 0,
            },
            {
              id: 'fields',
              header: t('studio.catalog.forms.colFields'),
              numeric: true,
              cell: (form) => counts.get(form.id)?.fields ?? 0,
            },
            {
              id: 'default',
              header: t('studio.catalog.forms.colDefault'),
              cell: (form) =>
                form.is_default ? (
                  <Text size="xs" as="span">
                    {t('studio.catalog.forms.isDefaultYes')}
                  </Text>
                ) : null,
            },
            {
              id: 'status',
              header: t('studio.catalog.forms.colStatus'),
              cell: (form) => (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill status={form.status} />
                  <VerificationPill verification={form.owner_verification} />
                </span>
              ),
            },
          ]}
        />

        {canWrite ? (
          <>
            <Divider />
            <PageHeader level={2} title={t('studio.catalog.forms.newHeading')} />
            <HelpText>{t('studio.catalog.forms.newNote')}</HelpText>
            <ActionForm action={createFormAction} className="grid max-w-md gap-4">
              <TextField
                name="name"
                label={t('studio.catalog.form.name')}
                required
                requiredLabel={t('studio.catalog.form.requiredLabel')}
              />
              <TextField
                name="slug"
                label={t('studio.catalog.form.slug')}
                required
                requiredLabel={t('studio.catalog.form.requiredLabel')}
              />
              <SelectField
                name="kind"
                label={t('studio.catalog.form.kind')}
                defaultValue="CUSTOM"
                options={[...KIND_OPTIONS]}
              />
              <TextAreaField
                name="description"
                label={t('studio.catalog.form.description')}
                help={t('studio.catalog.form.descriptionHelp')}
                rows={3}
              />
              <div>
                <Button type="submit">{t('studio.catalog.form.create')}</Button>
              </div>
            </ActionForm>

            <Divider />
            <PageHeader level={2} title={t('studio.catalog.forms.duplicateHeading')} />
            <HelpText>{t('studio.catalog.forms.duplicateNote')}</HelpText>
            {/*
              THE SOURCE LIST IS EVERY FORM, not only the three seeded templates. A studio that has
              built a fourth brief will want to start the fifth from it, and restricting the list to
              rows carrying a `seed_key` would make the templates permanently more privileged than
              the work done since.
            */}
            <ActionForm action={duplicateFormAction} className="grid max-w-md gap-4">
              <SelectField
                name="source_id"
                label={t('studio.catalog.forms.duplicateSource')}
                options={forms.map((form) => ({ value: form.id, label: form.name }))}
              />
              <TextField
                name="name"
                label={t('studio.catalog.form.name')}
                required
                requiredLabel={t('studio.catalog.form.requiredLabel')}
              />
              <TextField
                name="slug"
                label={t('studio.catalog.form.slug')}
                required
                requiredLabel={t('studio.catalog.form.requiredLabel')}
              />
              <div>
                <Button type="submit" disabled={forms.length === 0}>
                  {t('studio.catalog.forms.duplicate')}
                </Button>
              </div>
            </ActionForm>
          </>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
