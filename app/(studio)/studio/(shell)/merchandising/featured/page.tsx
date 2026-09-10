import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { loadEntityLists, loadSlot } from '@/components/studio/merchandising/load'
import { SlotEditor } from '@/components/studio/merchandising/SlotEditor'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listSlotsOwnedBy } from '@/lib/supabase/repositories/merchandising'
import { createClient } from '@/lib/supabase/server'

import { addEntryAction, entryAction, saveSlotSettingsAction } from '../actions'

/**
 * /studio/merchandising/featured — `HOMEPAGE_FEATURED_COLLECTIONS` and `STORE_FEATURED_ROW`.
 *
 * THE ONLY SCREEN THAT WRITES EITHER. Published collections only: a collection still in concept
 * is absent from the picker with an inline explanation, and `guard_merchandising_entry()` refuses
 * it at the row if a request arrives with one anyway (verification step 8).
 */
export const metadata = studioMetadata('/studio/merchandising/featured')

const ROUTE = '/studio/merchandising/featured'

export default async function Page() {
  const session = await requirePermission('catalog.read')
  const canWrite = roleHasPermission(session.role, 'merchandising.write')
  const client = await createClient()

  const owned = await listSlotsOwnedBy(client, ROUTE)
  const [lists, loaded] = await Promise.all([
    loadEntityLists(client, ['PRODUCT', 'COLLECTION', 'CATEGORY']),
    Promise.all(owned.map((slot) => loadSlot(client, slot))),
  ])

  return (
    <StudioPage path={ROUTE}>
      <Stack gap={10}>
        <HelpText>{t('studio.merchandising.featured.help')}</HelpText>
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
            conceptsWithheld={
              lists.conceptsWithheld &&
              (slot.allowed_entity_types as readonly string[]).includes('COLLECTION')
            }
          />
        ))}
      </Stack>
    </StudioPage>
  )
}
