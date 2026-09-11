'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { altTextWarnings } from '@/lib/media/alt-text-quality'

/**
 * The accessibility half of a media asset — Phase 41, WCAG 1.1.1.
 *
 * TWO FIELDS, EDITED TOGETHER, because the rule is about both: an asset either has a usable
 * sentence for somebody who cannot see it, or is explicitly marked as carrying nothing the
 * surrounding text does not already give. `0390`'s CHECK says exactly that, and the panel is shaped
 * so the two decisions are made in one act rather than one being used to escape the other.
 *
 * IT IS A CLIENT COMPONENT FOR ONE REASON: THE WARNING HAS TO APPEAR WHILE SOMEBODY IS TYPING. 124
 * of the 250 manifest assets carry alt text truncated mid-sentence and another 126 carry prompt
 * vocabulary, so the person editing is usually FIXING one — and a warning that only appears after a
 * save is a warning they will not read. `altTextWarnings` is pure and shared with the Phase 43
 * script, so the Studio and the gate cannot disagree about what bad alt text looks like.
 *
 * THE WARNING NEVER BLOCKS A SAVE. Whether a sentence describes the picture is a person's judgement;
 * a validator confident enough to refuse would eventually refuse a correct description that happened
 * to mention light. It says what it noticed and gets out of the way.
 *
 * NO CONTRAST PREVIEW YET. The phase document also asks for a contrast preview of any text overlaid
 * on the asset. That needs the overlay's own colour tokens, which live on the SECTION rather than on
 * the asset, so the preview belongs beside the section editor and is recorded as outstanding rather
 * than approximated here with a colour the overlay may not use.
 */

const WARNING_STRING: Record<string, string> = {
  TRUNCATED: 'studio.media.a11y.truncatedWarning',
  PROMPT_VOCABULARY: 'studio.media.a11y.promptWarning',
  REDUNDANT_PREFIX: 'studio.media.a11y.promptWarning',
  TOO_SHORT: 'studio.media.a11y.promptWarning',
}

export interface AccessibilityPanelProps {
  readonly assetId: string
  readonly altText: string
  readonly isDecorative: boolean
  /** The Server Action. Passed in so this component imports no server module. */
  readonly onSave: (input: {
    id: string
    altText: string
    isDecorative: boolean
  }) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function AccessibilityPanel({
  assetId,
  altText,
  isDecorative,
  onSave,
}: AccessibilityPanelProps): React.ReactElement {
  const [text, setText] = React.useState(altText)
  const [decorative, setDecorative] = React.useState(isDecorative)
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  // Recomputed on every keystroke; the rules are a handful of string tests over one short value.
  const warnings = React.useMemo(() => altTextWarnings(text), [text])

  async function save(): Promise<void> {
    setState('saving')
    setError(null)
    const result = await onSave({ id: assetId, altText: text, isDecorative: decorative })
    if (result.ok) {
      setState('saved')
      return
    }
    setState('error')
    setError(result.error)
  }

  return (
    <Stack gap={4} data-a11y-panel={assetId}>
      <Heading level={3} size="display-xs">
        {t('studio.media.a11y.heading')}
      </Heading>

      <Field label={t('studio.media.a11y.altLabel')} help={t('studio.media.a11y.altHelp')}>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setState('idle')
          }}
          rows={3}
          maxLength={500}
          className="w-full border border-line bg-surface px-3 py-2 text-sm text-ink"
          data-a11y-alt-text=""
        />
      </Field>

      {/*
       * `role="status"` rather than `role="alert"`. The warning appears as somebody types, and an
       * assertive live region would interrupt a screen-reader user mid-word on every keystroke.
       */}
      {warnings.length === 0 ? null : (
        <div role="status" data-a11y-warning="">
          <Stack gap={1}>
            {[...new Set(warnings.map((warning) => WARNING_STRING[warning]))].map((key) =>
              key === undefined ? null : (
                <Text key={key} size="sm" tone="secondary">
                  {t(key as never)}
                </Text>
              ),
            )}
          </Stack>
        </div>
      )}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={decorative}
          onChange={(event) => {
            setDecorative(event.target.checked)
            setState('idle')
          }}
          className="mt-1"
          data-a11y-decorative=""
        />
        <Stack gap={1}>
          <Text size="sm">{t('studio.media.a11y.decorativeLabel')}</Text>
          <Text size="sm" tone="secondary">
            {t('studio.media.a11y.decorativeHelp')}
          </Text>
        </Stack>
      </label>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            void save()
          }}
          disabled={state === 'saving' || text.trim() === ''}
        >
          {t('studio.media.a11y.save')}
        </Button>
        {state === 'saved' ? (
          <Text size="sm" tone="secondary" role="status">
            {t('studio.media.a11y.saved')}
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
