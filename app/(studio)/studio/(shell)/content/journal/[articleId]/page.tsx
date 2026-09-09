import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectField, TextAreaField, TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { RelatedContentPicker } from '@/components/studio/RelatedContentPicker'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { ArticlePublishControls } from '@/components/studio/content/ArticlePublishControls'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { siteString } from '@/lib/cms/strings'
import { getSiteChrome } from '@/lib/site/chrome'
import { NotFoundError } from '@/lib/supabase/errors'
import {
  RELATION_ENTITIES,
  RELATION_KINDS,
  getRelations,
} from '@/lib/supabase/repositories/entity-relations'
import { getArticleByIdForStudio, listCategories } from '@/lib/supabase/repositories/journal'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

import {
  createArticlePageAction,
  publishArticleAction,
  saveArticleBylineAction,
  saveArticleCoverAction,
  saveArticleIdentityAction,
  setArticleRelationAction,
  setArticleVerificationAction,
  unpublishArticleAction,
} from './actions'

/**
 * /studio/content/journal/[articleId] — one article.
 *
 * SIX PANELS, EACH ITS OWN FORM AND ITS OWN ACTION. Identity, byline, cover, body, related and
 * publishing are six different acts with three different permissions between them, and the split is
 * the same one the project editor makes for the same reason: a single form lets a hidden input
 * carry a claim alongside a typo correction. The byline is the one that matters most here — typing
 * a person's name asserts that a real individual wrote this, and that assertion is an owner's to
 * confirm.
 *
 * `reading_minutes` IS SHOWN AND CANNOT BE EDITED. A trigger derives it from the article's own
 * blocks on every write, so a field would be a box whose value is discarded. The sentence beside it
 * says so, because a number with no control next to it otherwise reads as an oversight.
 *
 * THE COVER SLOTS ARE PLAIN SELECTS, NOT `MediaPicker`. That component is a controlled client
 * control with its own search, built for the block editor where an editor is choosing among
 * hundreds of assets while composing a page. Here there are two slots on a form that must submit
 * with JavaScript off, like every other form on this screen, and a select does that.
 *
 * THERE IS NO `unpublish_at`. The phase document's Studio section names one; its own Database
 * section does not give `journal_articles` such a column, and inventing one to satisfy a sentence
 * would be modelling a feature nobody specified. Scheduling forward works — the public read is
 * gated on `published_at <= now()` — and taking an article down is a button somebody presses.
 */
export const metadata = studioMetadata('/studio/content/journal')

export default async function Page({
  params,
}: {
  readonly params: Promise<{ articleId: string }>
}) {
  const session = await requirePermission('content.read')
  const { articleId } = await params

  const client = await createClient()
  const article = await getArticleByIdForStudio(client, articleId).catch((error: unknown) => {
    // A row this role cannot see and one that does not exist are indistinguishable under RLS, and
    // must stay that way.
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (article === null) notFound()

  const [relations, categories, assets, chrome] = await Promise.all([
    getRelations(client, 'JOURNAL_ARTICLE', article.id),
    listCategories(client),
    listMediaAssets(client, { limit: 200 }),
    getSiteChrome(),
  ])

  const canWrite = roleHasPermission(session.role, 'content.write')
  const canVerify = roleHasPermission(session.role, 'content.verify')
  const canPublish = roleHasPermission(session.role, 'content.publish')
  const verified = article.owner_verification === 'VERIFIED'
  const needsVerification = article.owner_verification === 'OWNER_VERIFICATION_REQUIRED'

  const organisationName =
    siteString(chrome.strings, 'BRAND.brand.name') ??
    siteString(chrome.strings, 'SEO_DEFAULT.site_name') ??
    ''

  const label = (asset: (typeof assets)[number]) => asset.title ?? asset.filename ?? asset.public_id
  const assetOptions = [
    { value: '', label: t('studio.journal.coverNone') },
    ...assets.map((asset) => ({ value: asset.id, label: label(asset) })),
  ]

  return (
    <StudioPage path="/studio/content/journal">
      <Stack gap={8}>
        <PageHeader
          level={1}
          title={article.title === '' ? t('studio.journal.untitled') : article.title}
          description={article.slug}
          actions={<StatusPill status={article.status} />}
        />

        <Link href={'/studio/content/journal' as Route} className="underline underline-offset-4">
          <Text size="sm" as="span">
            {t('studio.journal.backToList')}
          </Text>
        </Link>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.journal.publishHeading')} />
          <HelpText>{t('studio.journal.publishHelp')}</HelpText>
          {needsVerification ? (
            <Text size="sm" tone="secondary" data-verification-outstanding="">
              {t('studio.journal.verifyHelp')}
            </Text>
          ) : null}
          {canVerify ? (
            <ActionForm action={setArticleVerificationAction}>
              <input type="hidden" name="id" value={article.id} />
              {/* The value is the state being asked for, never a toggle computed from this render. */}
              <Button
                type="submit"
                name="owner_verification"
                value={verified ? 'OWNER_VERIFICATION_REQUIRED' : 'VERIFIED'}
                variant={verified ? 'secondary' : 'primary'}
              >
                {verified ? t('studio.journal.verifyClear') : t('studio.journal.verifySet')}
              </Button>
            </ActionForm>
          ) : null}
          {canPublish ? (
            <ArticlePublishControls
              articleId={article.id}
              isPublished={article.status === 'PUBLISHED'}
              publishedAt={article.published_at}
              publishAction={publishArticleAction}
              unpublishAction={unpublishArticleAction}
            />
          ) : null}
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.journal.identityHeading')} />
          <ActionForm action={saveArticleIdentityAction} className="grid max-w-2xl gap-4">
            <input type="hidden" name="id" value={article.id} />
            <TextField
              name="title"
              label={t('studio.journal.fieldTitle')}
              defaultValue={article.title}
              required
              requiredLabel={t('studio.journal.requiredLabel')}
            />
            <TextField
              name="standfirst"
              label={t('studio.journal.fieldStandfirst')}
              help={t('studio.journal.fieldStandfirstHelp')}
              defaultValue={article.standfirst ?? ''}
            />
            <TextField
              name="excerpt"
              label={t('studio.journal.fieldExcerpt')}
              help={t('studio.journal.fieldExcerptHelp')}
              defaultValue={article.excerpt ?? ''}
            />
            <TextAreaField
              name="angle_note"
              label={t('studio.journal.fieldAngle')}
              help={t('studio.journal.fieldAngleHelp')}
              defaultValue={article.angle_note ?? ''}
            />
            <SelectField
              name="primary_category_id"
              label={t('studio.journal.fieldCategory')}
              help={t('studio.journal.fieldCategoryHelp')}
              defaultValue={article.primary_category_id ?? ''}
              options={[
                { value: '', label: t('studio.journal.categoryNone') },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
            />
            <HelpText>
              {t('studio.journal.readingMinutes')}
              {article.reading_minutes === null ? null : ` — ${article.reading_minutes}`}
            </HelpText>
            <div>
              <Button type="submit" disabled={!canWrite}>
                {t('studio.journal.identitySave')}
              </Button>
            </div>
          </ActionForm>
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.journal.fieldByline')} />
          <ActionForm action={saveArticleBylineAction} className="grid max-w-2xl gap-4">
            <input type="hidden" name="id" value={article.id} />
            {/*
              The studio's own name travels with the form so the action can tell "this is us" from
              "this is a person" without reading the chrome again inside the action — and so a
              rename of the business is one row, not two places.
            */}
            <input type="hidden" name="organisation_name" value={organisationName} />
            <TextField
              name="byline"
              label={t('studio.journal.fieldByline')}
              help={t('studio.journal.fieldBylineHelp')}
              defaultValue={article.byline}
            />
            <div>
              <Button type="submit" disabled={!canWrite}>
                {t('studio.journal.identitySave')}
              </Button>
            </div>
          </ActionForm>
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.journal.bodyHeading')} />
          <HelpText>{t('studio.journal.bodyHelp')}</HelpText>
          {article.page_id === null ? (
            canWrite ? (
              <ActionForm action={createArticlePageAction}>
                <input type="hidden" name="id" value={article.id} />
                <Button type="submit">{t('studio.journal.bodyCreate')}</Button>
              </ActionForm>
            ) : null
          ) : (
            <Link
              href={`/studio/content/pages/${article.page_id}` as Route}
              className="underline underline-offset-4"
              data-article-page={article.page_id}
            >
              <Text size="sm" as="span">
                {t('studio.journal.bodyEdit')}
              </Text>
            </Link>
          )}
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.journal.coverHeading')} />
          <HelpText>{t('studio.journal.coverHelp')}</HelpText>
          <ActionForm action={saveArticleCoverAction} className="grid max-w-2xl gap-4">
            <input type="hidden" name="id" value={article.id} />
            <SelectField
              name="cover_media_id"
              label={t('studio.journal.coverDesktop')}
              defaultValue={article.cover_media_id ?? ''}
              options={assetOptions}
            />
            <SelectField
              name="cover_mobile_media_id"
              label={t('studio.journal.coverMobile')}
              defaultValue={article.cover_mobile_media_id ?? ''}
              options={assetOptions}
            />
            <div>
              <Button type="submit" disabled={!canWrite}>
                {t('studio.journal.coverSave')}
              </Button>
            </div>
          </ActionForm>
        </Stack>

        <Divider />

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.journal.relationsHeading')} />
          <HelpText>{t('studio.journal.relationsHelp')}</HelpText>
          <RelatedContentPicker
            sourceId={article.id}
            rows={relations.map((edge) => ({
              id: edge.id,
              targetType: edge.target_type,
              targetId: edge.target_id,
              relationType: edge.relation_type,
              note: edge.note,
            }))}
            targetTypes={RELATION_ENTITIES}
            relationTypes={RELATION_KINDS}
            canWrite={canWrite}
            action={setArticleRelationAction}
          />
        </Stack>
      </Stack>
    </StudioPage>
  )
}
