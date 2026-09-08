'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Dialog } from '@/components/patterns/Dialog'
import { EmptyState } from '@/components/studio/EmptyState'
import { t } from '@/components/studio/strings'

/**
 * Choose one asset for a section slot.
 *
 * IT IS GIVEN ITS CANDIDATES, IT DOES NOT FETCH THEM. The page has already read `media_assets`
 * through the request-scoped client, so the list here is exactly what RLS let this editor see. A
 * component that fetched its own would need a second endpoint returning media rows, which is a
 * second place for that policy to be got wrong.
 *
 * IT SHOWS WHY AN ASSET WOULD BLOCK A PUBLISH, at the moment of choosing. Every one of the 250
 * imported Higgsfield assets is `APPROVED` and `OWNER_VERIFICATION_REQUIRED`, which is exactly
 * what `cms_publish_section` refuses with RV006 — so an editor who is not told here will build a
 * whole page and discover it at the last step. The asset is still selectable: binding it is
 * legitimate work, and the refusal belongs at publish, not at choose.
 */

export type PickerAsset = {
  readonly id: string
  readonly label: string
  readonly altText: string
  readonly thumbnailUrl: string | null
  readonly status: string
  readonly ownerVerification: string
}

export type MediaPickerProps = {
  readonly name: string
  readonly label: string
  readonly help?: string
  readonly assets: readonly PickerAsset[]
  readonly value: string | null
  readonly onChange: (id: string | null) => void
}

/** The two states that stop a bound asset from being published, in the words an editor needs. */
function blockingNote(asset: PickerAsset): string | null {
  if (asset.status !== 'APPROVED' && asset.status !== 'PUBLISHED') {
    return t('studio.content.media.unapprovedNote')
  }
  if (asset.ownerVerification === 'OWNER_VERIFICATION_REQUIRED') {
    return t('studio.content.media.unverifiedNote')
  }
  return null
}

export function MediaPicker({
  name,
  label,
  help,
  assets,
  value,
  onChange,
}: MediaPickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const chosen = value === null ? null : (assets.find((asset) => asset.id === value) ?? null)

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return assets
    return assets.filter(
      (asset) =>
        asset.label.toLowerCase().includes(needle) || asset.altText.toLowerCase().includes(needle),
    )
  }, [assets, query])

  return (
    <Stack gap={2}>
      {/* The form's actual value. A hidden input rather than component state alone, so the
          enclosing <form> submits the choice even if this component never re-renders. */}
      <input type="hidden" name={name} value={value ?? ''} readOnly />

      <Text size="sm" as="span" id={`${name}-label`}>
        {label}
      </Text>
      {help === undefined ? null : (
        <Text size="xs" tone="tertiary">
          {help}
        </Text>
      )}

      <Cluster gap={3} className="items-center">
        {chosen === null ? (
          <Text size="sm" tone="tertiary">
            {t('studio.content.media.noneChosen')}
          </Text>
        ) : (
          <Cluster gap={2} className="items-center">
            {chosen.thumbnailUrl === null ? null : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chosen.thumbnailUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 rounded-(--rv-radius-xs) object-cover"
              />
            )}
            <Stack gap={0}>
              <Text size="sm">{chosen.label}</Text>
              {blockingNote(chosen) === null ? null : (
                <Text size="xs" tone="tertiary">
                  {blockingNote(chosen)}
                </Text>
              )}
            </Stack>
          </Cluster>
        )}

        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {t('studio.content.media.chooseLabel')}
        </Button>
        {chosen === null ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t('studio.content.media.clearLabel')}
          </Button>
        )}
      </Cluster>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('studio.content.media.pickerHeading')}
        closeLabel={t('studio.content.section.closeLabel')}
      >
        <Stack gap={4}>
          <Input
            type="search"
            value={query}
            aria-label={t('studio.content.media.searchLabel')}
            onChange={(event) => setQuery(event.target.value)}
          />

          {matches.length === 0 ? (
            <EmptyState
              reason={query.trim() === '' ? 'empty' : 'filtered'}
              heading={t('studio.content.media.emptyHeading')}
              body={t('studio.content.media.emptyBody')}
            />
          ) : (
            <ul className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {matches.map((asset) => {
                const note = blockingNote(asset)
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(asset.id)
                        setOpen(false)
                      }}
                      aria-pressed={asset.id === value}
                      className="w-full rounded-(--rv-radius-sm) border border-line p-2 text-left hover:bg-surface-raised aria-pressed:border-line-strong"
                    >
                      <Stack gap={1}>
                        {asset.thumbnailUrl === null ? (
                          <div className="aspect-4/3 w-full rounded-(--rv-radius-xs) bg-surface-sunken" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asset.thumbnailUrl}
                            alt=""
                            className="aspect-4/3 w-full rounded-(--rv-radius-xs) object-cover"
                          />
                        )}
                        <Text size="xs">{asset.label}</Text>
                        {note === null ? null : (
                          <Text size="xs" tone="tertiary">
                            {note}
                          </Text>
                        )}
                      </Stack>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Stack>
      </Dialog>
    </Stack>
  )
}
