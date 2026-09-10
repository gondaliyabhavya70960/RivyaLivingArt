import { Button } from '@/components/primitives/Button'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { flagStates } from '@/lib/flags'

import { setFlagAction } from './actions'

/**
 * /studio/system/flags — the register of what is switched on.
 *
 * EVERY ROLE READS IT AND TWO ROLES MOVE IT. `studio.access` is held by all six roles, and that is
 * deliberate rather than lax: the register is how anybody in the Studio accounts for a surface that
 * is missing. A merchandiser who cannot find the configurator should be able to see that it is off,
 * not conclude the Studio is broken. STUDIO_GUIDE §2.3 rejected hiding the list behind the write
 * permission for exactly that reason.
 *
 * THE CONTROLS ARE ABSENT FOR A ROLE THAT MAY NOT USE THEM, not disabled. A greyed-out switch reads
 * as "ask somebody to enable this"; the truth is that the decision is not theirs to make. The
 * Server Action re-checks `system.flags.write` regardless — this is the affordance, not the guard.
 *
 * THE LIST COMES FROM THE CODE, NOT FROM THE TABLE. `flagStates()` walks the register in
 * `lib/flags/flags.ts`, so a flag nobody has touched still appears here — off, with its description
 * — instead of being invisible until someone switches it. A row in `feature_flags` naming a key
 * that is no longer registered is a leftover from a removed feature and is simply not listed.
 *
 * NOT A TABLE, DELIBERATELY. Each row carries a paragraph explaining what the flag gates and, in
 * two of two cases so far, which phase has to ship before it can honestly be switched on. That is
 * the sentence somebody needs before moving a switch, and a table cell is where it would be
 * truncated.
 */
export const metadata = studioMetadata('/studio/system/flags')

export default async function Page() {
  const session = await requirePermission('studio.access')
  const flags = await flagStates()
  const canWrite = roleHasPermission(session.role, 'system.flags.write')

  return (
    <StudioPage path="/studio/system/flags">
      <Stack gap={8}>
        <HelpText>{t('studio.system.flags.help')}</HelpText>
        <HelpText>{t('studio.system.flags.registerNote')}</HelpText>
        {canWrite ? null : <HelpText>{t('studio.system.flags.readOnlyNote')}</HelpText>}

        {flags.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.system.flags.emptyHeading')}
            body={t('studio.system.flags.emptyBody')}
          />
        ) : (
          flags.map((flag) => (
            <Stack
              key={flag.key}
              gap={3}
              className="border-t border-(--color-border) pt-6"
              data-feature-flag={flag.key}
              data-flag-state={flag.isEnabled ? 'on' : 'off'}
            >
              <PageHeader
                level={2}
                title={flag.key}
                description={
                  flag.isEnabled ? t('studio.system.flags.on') : t('studio.system.flags.off')
                }
              />
              <Text size="sm" tone="secondary">
                {flag.description}
              </Text>
              {canWrite ? (
                <ActionForm action={setFlagAction}>
                  <input type="hidden" name="key" value={flag.key} />
                  {/*
                    The target state, not a toggle. Two people with this screen open would otherwise
                    send opposite instructions computed from the same stale markup.
                  */}
                  <input type="hidden" name="enabled" value={flag.isEnabled ? 'false' : 'true'} />
                  <Button type="submit" variant={flag.isEnabled ? 'secondary' : 'primary'}>
                    {flag.isEnabled
                      ? t('studio.system.flags.disable')
                      : t('studio.system.flags.enable')}
                  </Button>
                </ActionForm>
              ) : null}
            </Stack>
          ))
        )}
      </Stack>
    </StudioPage>
  )
}
