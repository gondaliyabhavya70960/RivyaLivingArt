'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Dialog } from '@/components/patterns/Dialog'
import type { PickerAsset } from '@/components/studio/MediaPicker'
import { t } from '@/components/studio/strings'
import {
  createSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  transitionSectionAction,
  updateSectionAction,
} from '@/app/(studio)/studio/(shell)/content/actions'
import type { Permission } from '@/lib/auth/permissions'
import { BLOCK_TYPES } from '@/lib/cms/block-types'
import { addableBlocks, blockModule, isBuilt } from '@/lib/cms/registry'
import type { PageSection } from '@/lib/supabase/schemas'

import { SectionBoard } from './SectionBoard'
import type { SectionFormValues } from './section-form-values'

/**
 * The client half of `/studio/content/pages/[pageId]`.
 *
 * IT OWNS NO DATA. The sections, the assets and the permissions all arrive as props from the
 * Server Component that read them through the request-scoped client; every mutation goes back
 * through a Server Action that re-checks the permission and then revalidates, which re-renders
 * this component with the new rows. There is no client-side cache to go stale.
 *
 * THE BLOCK PICKER SHOWS THE WHOLE CATALOGUE, with the unbuilt ones listed separately and not
 * selectable. Hiding them would leave an editor wondering whether a block they were promised
 * exists; offering them would let them add a section the public site skips in silence.
 */

export type PageEditorProps = {
  readonly pageId: string
  readonly pagePath: string | null
  readonly sections: readonly PageSection[]
  readonly assets: readonly PickerAsset[]
  readonly slotKeys: readonly string[]
  readonly permissions: readonly Permission[]
  /** Seeded verification notes by `seed_key`, loaded on the server. See `VerificationBanner`. */
  readonly verificationNotes?: ReadonlyMap<string, string>
}

export function PageEditor({
  pageId,
  pagePath,
  sections,
  assets,
  slotKeys,
  permissions,
  verificationNotes,
}: PageEditorProps): React.ReactElement {
  const [adding, setAdding] = React.useState(false)
  const [addError, setAddError] = React.useState<string | null>(null)

  const canWrite = permissions.includes('content.write')
  const canDelete = permissions.includes('destructive.execute')

  const addable = addableBlocks(pagePath)
  const planned = BLOCK_TYPES.filter((type) => !isBuilt(type)).map(blockModule)

  return (
    <Stack gap={6}>
      <Cluster gap={3} className="items-center justify-between">
        <Heading level={2} size="display-sm">
          {t('studio.content.page.sectionsHeading')}
        </Heading>
        <Cluster gap={3}>
          {pagePath === null ? null : (
            /**
             * A PLAIN ANCHOR, NOT `Link` AND NOT `router.push`. `/api/preview` is a Route Handler
             * whose whole effect is the `Set-Cookie` on its response — draft mode IS that cookie.
             * A client-side navigation never issues the document request that would receive it, so
             * the router would change the URL and the preview would show published content. A real
             * link is the only thing that works here, and it is also what a middle-click and
             * "open in new tab" expect.
             */
            <a
              href={`/api/preview?path=${encodeURIComponent(pagePath)}`}
              className="inline-flex h-9 items-center rounded-(--rv-radius-sm) border border-line-strong px-4 text-sm text-ink hover:bg-surface-raised"
            >
              {t('studio.content.page.previewLabel')}
            </a>
          )}
          {canWrite ? (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              {t('studio.content.page.addLabel')}
            </Button>
          ) : null}
        </Cluster>
      </Cluster>

      <SectionBoard
        pageId={pageId}
        sections={sections}
        assets={assets}
        slotKeys={slotKeys}
        canWrite={canWrite}
        canDelete={canDelete}
        permissions={permissions}
        verificationNotes={verificationNotes}
        onSave={(values: SectionFormValues) => updateSectionAction(values).then(toOutcome)}
        onDelete={(sectionId) => deleteSectionAction({ sectionId, pageId }).then(toOutcome)}
        onReorder={(sectionIds) => reorderSectionsAction({ pageId, sectionIds }).then(toOutcome)}
        onTransition={(sectionId, from, to) =>
          transitionSectionAction({ sectionId, pageId, from, to, changeSummary: null }).then(
            toOutcome,
          )
        }
      />

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t('studio.content.page.addHeading')}
        closeLabel={t('studio.content.section.closeLabel')}
      >
        <Stack gap={5}>
          {addError === null ? null : (
            <Text size="sm" tone="secondary">
              {addError}
            </Text>
          )}

          <ul className="flex list-none flex-col gap-2">
            {addable.map((block) => (
              <li key={block.type}>
                <button
                  type="button"
                  className="w-full rounded-(--rv-radius-sm) border border-line p-3 text-left hover:bg-surface-raised"
                  onClick={() => {
                    setAddError(null)
                    void createSectionAction({ pageId, blockType: block.type }).then((result) => {
                      if (result.ok) setAdding(false)
                      else setAddError(result.error)
                    })
                  }}
                >
                  <Stack gap={1}>
                    <Text size="sm">{block.label}</Text>
                    <Text size="xs" tone="tertiary">
                      {block.description}
                    </Text>
                  </Stack>
                </button>
              </li>
            ))}
          </ul>

          <Stack gap={2}>
            <Heading level={3} size="display-xs">
              {t('studio.content.page.plannedHeading')}
            </Heading>
            <Text size="xs" tone="tertiary">
              {t('studio.content.page.plannedBody')}
            </Text>
            <Text size="xs" tone="tertiary">
              {planned.map((block) => block.label).join(' · ')}
            </Text>
          </Stack>
        </Stack>
      </Dialog>
    </Stack>
  )
}

/** Server Actions return a discriminated result; the board wants a uniform one. */
function toOutcome(result: { ok: boolean; error?: string }): { ok: boolean; error?: string } {
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}
