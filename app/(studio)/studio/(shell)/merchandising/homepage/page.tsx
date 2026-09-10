import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { SelectField, TextField } from '@/components/studio/FormField'
import { loadEntityLists, loadSlot } from '@/components/studio/merchandising/load'
import { SlotEditor, SlotPreview } from '@/components/studio/merchandising/SlotEditor'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { resolveSlot } from '@/lib/cms/merchandising'
import { getPageByPath, listSectionsForPage } from '@/lib/supabase/repositories/cms'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { listSlotsOwnedBy } from '@/lib/supabase/repositories/merchandising'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'

import {
  addEntryAction,
  entryAction,
  saveHeroStillAction,
  saveSelectedWorksHeadingAction,
  saveSlotSettingsAction,
} from '../actions'

/**
 * /studio/merchandising/homepage — the two homepage slots this screen owns, plus the hero still
 * and the Selected Works heading.
 *
 * TWO SLOTS, NOT THREE. `HOMEPAGE_SELECTED_WORKS` and `HOMEPAGE_JOURNAL_STRIP` are owned here;
 * `HOMEPAGE_FEATURED_COLLECTIONS` is owned by the Featured screen and appears here as a read-only
 * preview with a link, so the owner can see the whole homepage from one place without a second
 * editor for the same slot existing anywhere.
 *
 * THE HERO STILL AND THE HEADING ARE `page_sections` EDITS and need `content.write`. A merchandiser
 * sees the current values and the note; the controls are drawn for a role that can use them, and
 * the action re-checks regardless. Read under `catalog.read`, which every role holds.
 */
export const metadata = studioMetadata('/studio/merchandising/homepage')

const ROUTE = '/studio/merchandising/homepage'

export default async function Page() {
  const session = await requirePermission('catalog.read')
  const canWrite = roleHasPermission(session.role, 'merchandising.write')
  const canEditContent = roleHasPermission(session.role, 'content.write')
  const client = await createClient()

  const owned = await listSlotsOwnedBy(client, ROUTE)
  const [lists, loaded, featured, homepage] = await Promise.all([
    loadEntityLists(client, ['PRODUCT', 'JOURNAL_ARTICLE']),
    Promise.all(owned.map((slot) => loadSlot(client, slot))),
    resolveSlot(createPublicClient(), 'HOMEPAGE_FEATURED_COLLECTIONS'),
    getPageByPath(client, '/'),
  ])
  const sections = homepage === null ? [] : await listSectionsForPage(client, homepage.id)
  const hero = sections.find((section) => section.block_type === 'hero') ?? null
  const selectedWorks = sections.find((section) => section.block_type === 'selected-works') ?? null
  const images =
    canEditContent && hero !== null
      ? await listMediaAssets(client, { kind: 'IMAGE', limit: 200 })
      : []
  const imageOptions = [
    { value: '', label: t('studio.merchandising.homepage.heroNone') },
    ...images.map((asset) => ({
      value: asset.id,
      label: asset.title ?? asset.alt_text ?? asset.public_id,
    })),
  ]

  return (
    <StudioPage path={ROUTE}>
      <Stack gap={10}>
        <HelpText>{t('studio.merchandising.homepage.help')}</HelpText>
        {canWrite ? null : <HelpText>{t('studio.merchandising.readOnlyNote')}</HelpText>}

        {loaded.map(({ slot, entries, preview }) => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            entries={entries}
            labels={lists.labels}
            candidates={lists.candidates.filter((candidate) =>
              (slot.allowed_entity_types as readonly string[]).includes(candidate.type),
            )}
            preview={preview}
            route={ROUTE}
            canWrite={canWrite}
            addAction={addEntryAction}
            entryAction={entryAction}
            settingsAction={saveSlotSettingsAction}
          />
        ))}

        <Divider />
        <Stack gap={3} data-featured-preview="">
          <HelpText>{t('studio.merchandising.homepage.featuredNote')}</HelpText>
          <SlotPreview preview={featured} />
          <div>
            <Link
              href={'/studio/merchandising/featured' as Route}
              className="underline underline-offset-4"
            >
              {t('studio.merchandising.homepage.featuredLink')}
            </Link>
          </div>
        </Stack>

        <Divider />
        {homepage === null || hero === null ? (
          <HelpText>{t('studio.merchandising.homepage.noHomepage')}</HelpText>
        ) : (
          <Stack gap={3} data-hero-override="">
            <PageHeader
              level={2}
              title={t('studio.merchandising.homepage.heroHeading')}
              description={t('studio.merchandising.homepage.heroHelp')}
            />
            {canEditContent ? (
              <ActionForm action={saveHeroStillAction}>
                <Stack gap={3}>
                  <input type="hidden" name="section_id" value={hero.id} />
                  <SelectField
                    name="media_desktop_id"
                    label={t('studio.merchandising.homepage.heroDesktop')}
                    defaultValue={hero.media_desktop_id ?? ''}
                    options={imageOptions}
                  />
                  <SelectField
                    name="media_mobile_id"
                    label={t('studio.merchandising.homepage.heroMobile')}
                    defaultValue={hero.media_mobile_id ?? ''}
                    options={imageOptions}
                  />
                  <div>
                    <Button type="submit">{t('studio.merchandising.homepage.heroSave')}</Button>
                  </div>
                </Stack>
              </ActionForm>
            ) : (
              <Text size="sm" tone="secondary">
                {t('studio.merchandising.homepage.contentOnly')}
              </Text>
            )}
          </Stack>
        )}

        {selectedWorks === null ? null : (
          <Stack gap={3} data-selected-works-heading="">
            <PageHeader
              level={2}
              title={t('studio.merchandising.homepage.headingHeading')}
              description={t('studio.merchandising.homepage.headingHelp')}
            />
            {canEditContent ? (
              <ActionForm action={saveSelectedWorksHeadingAction}>
                <Stack gap={3}>
                  <input type="hidden" name="section_id" value={selectedWorks.id} />
                  <TextField
                    name="heading"
                    label={t('studio.merchandising.homepage.headingField')}
                    defaultValue={selectedWorks.heading ?? ''}
                  />
                  <div>
                    <Button type="submit">{t('studio.merchandising.homepage.headingSave')}</Button>
                  </div>
                </Stack>
              </ActionForm>
            ) : (
              <Text size="sm">{selectedWorks.heading ?? '—'}</Text>
            )}
          </Stack>
        )}
      </Stack>
    </StudioPage>
  )
}
