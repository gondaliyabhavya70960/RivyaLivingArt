'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Heading } from '@/components/primitives/Heading'
import { HelpText } from '@/components/primitives/HelpText'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { boxFitsSource, ratioDrift, type MediaCropRow } from '@/lib/media/crop'
import type { AspectRatio } from '@/lib/media/types'

/**
 * ONE MASTER, SEVERAL SHAPES — Phase 43, RC-359.
 *
 * D6 keeps desktop and mobile as separate slots with different ratios, so the same 4800px picture
 * is legitimately asked for at 21:9 and at 9:16. Cloudinary will crop automatically, and for these
 * 250 AI-generated stills it routinely crops badly: the subject was composed for the edges it was
 * generated at, and an automatic centre crop to 9:16 cuts a table in half. So a person chooses.
 *
 * THE PREVIEW IS THE SAME MATHS THE SITE DELIVERS. `boxFitsSource` and `ratioDrift` are the pure
 * functions in `lib/media/crop.ts` that the public renderer uses; this component imports them
 * rather than reimplementing, so what an editor is warned about here is what a visitor would get.
 *
 * IT WARNS AND DOES NOT BLOCK, with one exception. A box outside the source is not a judgement call
 * — Cloudinary would refuse it or clamp it silently — so the save button is disabled for that. A box
 * that drifts from its nominal ratio is a judgement: the delivered image gets squared up and a
 * sliver is lost, which an editor may accept, so it is a warning beside the field.
 *
 * NUMBERS RATHER THAN A DRAG HANDLE, and that is a real limitation stated plainly. A drag-to-crop
 * overlay is the better interface and it needs pointer maths, a resize model and a keyboard
 * equivalent that a `tabIndex` and four arrow keys cannot fake. Typed pixels are exact, keyboard-
 * accessible by construction, and honest about being a first version; the fields are the same four
 * the database stores, so nothing has to be migrated when the overlay arrives.
 */

const RATIOS: readonly AspectRatio[] = ['21:9', '16:9', '4:3', '3:2', '1:1', '4:5', '3:4', '9:16']

const GRAVITIES = [
  'auto',
  'center',
  'north',
  'south',
  'east',
  'west',
  'north_east',
  'north_west',
  'south_east',
  'south_west',
] as const

export interface CropEditorProps {
  readonly assetId: string
  /** The master's real dimensions, so a box can be checked against them. */
  readonly source: { readonly width: number; readonly height: number }
  readonly crops: readonly (MediaCropRow & { readonly note?: string | null })[]
  readonly onSave: (input: {
    assetId: string
    aspectRatio: string
    x: number | null
    y: number | null
    width: number | null
    height: number | null
    gravity: string | null
    note: string | null
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  readonly onRemove: (input: {
    assetId: string
    aspectRatio: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
}

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) ? parsed : null
}

export function CropEditor({
  assetId,
  source,
  crops,
  onSave,
  onRemove,
}: CropEditorProps): React.ReactElement {
  const [ratio, setRatio] = React.useState<AspectRatio>('16:9')
  const existing = crops.find((crop) => crop.aspect_ratio === ratio)

  return (
    <Stack gap={4} data-crop-editor={assetId}>
      <Stack gap={1}>
        <Heading level={2} size="display-xs">
          {t('studio.media.crop.heading')}
        </Heading>
        <HelpText>{t('studio.media.crop.body')}</HelpText>
      </Stack>

      <Field label={t('studio.media.crop.ratioLabel')} controlId="crop-ratio">
        <Select
          id="crop-ratio"
          value={ratio}
          onChange={(event) => {
            setRatio(event.target.value as AspectRatio)
          }}
        >
          {RATIOS.map((value) => (
            <option key={value} value={value}>
              {crops.some((crop) => crop.aspect_ratio === value) ? `${value} · set` : value}
            </option>
          ))}
        </Select>
      </Field>

      {/*
        KEYED ON THE RATIO, which is what resets the four boxes when somebody switches shape.
        The alternative — an effect that writes six pieces of state when a prop changes — is the
        cascading-render pattern React 19 refuses, and it would also lose an unsaved edit silently
        rather than visibly. A remount is the honest reading of "this is a different crop now".
      */}
      <CropForm
        key={ratio}
        assetId={assetId}
        ratio={ratio}
        source={source}
        existing={existing}
        onSave={onSave}
        onRemove={onRemove}
      />
    </Stack>
  )
}

function CropForm({
  assetId,
  ratio,
  source,
  existing,
  onSave,
  onRemove,
}: {
  readonly assetId: string
  readonly ratio: AspectRatio
  readonly source: { readonly width: number; readonly height: number }
  readonly existing: (MediaCropRow & { readonly note?: string | null }) | undefined
  readonly onSave: CropEditorProps['onSave']
  readonly onRemove: CropEditorProps['onRemove']
}): React.ReactElement {
  const [x, setX] = React.useState(existing?.x === null ? '' : String(existing?.x ?? ''))
  const [y, setY] = React.useState(existing?.y === null ? '' : String(existing?.y ?? ''))
  const [width, setWidth] = React.useState(
    existing?.width === null ? '' : String(existing?.width ?? ''),
  )
  const [height, setHeight] = React.useState(
    existing?.height === null ? '' : String(existing?.height ?? ''),
  )
  const [gravity, setGravity] = React.useState(existing?.gravity ?? '')
  const [note, setNote] = React.useState(existing?.note ?? '')
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const candidate: MediaCropRow = {
    aspect_ratio: ratio,
    x: numberOrNull(x),
    y: numberOrNull(y),
    width: numberOrNull(width),
    height: numberOrNull(height),
    gravity: gravity === '' ? null : gravity,
  }

  const hasBox = candidate.width !== null && candidate.height !== null
  const partialBox = !hasBox && [x, y, width, height].some((value) => value.trim() !== '')
  const fits = boxFitsSource(candidate, source)
  const drift = hasBox ? ratioDrift(candidate, ratio) : null
  const describesNothing = !hasBox && candidate.gravity === null

  async function save(): Promise<void> {
    setState('saving')
    setError(null)
    const result = await onSave({
      assetId,
      aspectRatio: ratio,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
      gravity: candidate.gravity,
      note: note.trim() === '' ? null : note.trim(),
    })
    setState(result.ok ? 'saved' : 'error')
    if (!result.ok) setError(result.error)
  }

  async function remove(): Promise<void> {
    setState('saving')
    const result = await onRemove({ assetId, aspectRatio: ratio })
    setState(result.ok ? 'idle' : 'error')
    if (!result.ok) setError(result.error)
  }

  return (
    <Stack gap={4}>
      {existing === undefined ? (
        <Text size="sm" tone="secondary">
          {t('studio.media.crop.none')}
        </Text>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            ['x', x, setX],
            ['y', y, setY],
            ['width', width, setWidth],
            ['height', height, setHeight],
          ] as const
        ).map(([name, value, set]) => (
          <Field key={name} label={name} controlId={`crop-${name}`}>
            <Input
              id={`crop-${name}`}
              inputMode="numeric"
              value={value}
              onChange={(event) => {
                set(event.target.value)
                setState('idle')
              }}
            />
          </Field>
        ))}
      </div>

      <Text size="xs" tone="tertiary">
        {`Source ${String(source.width)} × ${String(source.height)} px. The box is measured against these.`}
      </Text>

      <Field label={t('studio.media.crop.gravityLabel')} controlId="crop-gravity">
        <Select
          id="crop-gravity"
          value={gravity}
          onChange={(event) => {
            setGravity(event.target.value)
            setState('idle')
          }}
        >
          <option value="">—</option>
          {GRAVITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('studio.media.crop.noteLabel')} help={t('studio.media.crop.noteHelp')}>
        <Input
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
          }}
          maxLength={300}
        />
      </Field>

      {/* Warnings, in a polite live region: they appear as somebody types four numbers. */}
      <div role="status">
        <Stack gap={1}>
          {fits ? null : (
            <Text size="sm" data-crop-warning="bounds">
              {t('studio.media.crop.outOfBounds')}
            </Text>
          )}
          {drift !== null && drift > 0.05 ? (
            <Text size="sm" tone="secondary" data-crop-warning="drift">
              {t('studio.media.crop.drift')}
            </Text>
          ) : null}
        </Stack>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            void save()
          }}
          disabled={state === 'saving' || !fits || partialBox || describesNothing}
          data-crop-save=""
        >
          {t('studio.media.crop.save')}
        </Button>
        {existing === undefined ? null : (
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              void remove()
            }}
            disabled={state === 'saving'}
            data-crop-remove=""
          >
            {t('studio.media.crop.remove')}
          </Button>
        )}
        {state === 'saved' ? (
          <Text size="sm" tone="secondary" role="status">
            {t('studio.media.crop.saved')}
          </Text>
        ) : null}
        {state === 'error' && error !== null ? (
          <Text size="sm" role="alert">
            {error}
          </Text>
        ) : null}
      </div>
    </Stack>
  )
}
