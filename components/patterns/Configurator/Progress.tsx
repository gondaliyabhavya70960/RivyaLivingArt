import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { interpolate } from '@/lib/cms/strings'

/**
 * Where the visitor is in the brief.
 *
 * A SENTENCE AND A BAR, NOT ELEVEN DOTS. A dot per step is unreadable at eleven and meaningless on
 * a form whose length changes with the template — the preservation brief has six enabled steps and
 * the furniture one ten, because a step a template has no questions for is switched off. The
 * sentence is a seeded string with `{{current}}` and `{{total}}` in it, so it survives an owner
 * rewording it and a language that puts the number first.
 *
 * THE BAR CARRIES NO ROLE AND NO VALUE ATTRIBUTES, and the first version of this file got that
 * wrong twice over. `role="group"` does not support `aria-valuenow` — the linter said so — and
 * `role="progressbar"` would have been worse rather than better: it announces a percentage, which
 * is not what a visitor wants to know, and it would announce it IN ADDITION to a sentence already
 * on the screen saying the same thing more clearly.
 *
 * So the sentence is the accessible answer and the bar is decoration. A screen reader hears
 * "Step 4 of 10"; a sighted reader gets the same words plus a line that shows how far along it is.
 * Neither is told anything twice.
 */
export interface ProgressProps {
  readonly current: number
  readonly total: number
  readonly label: string
  readonly sentence: string
}

export function ConfiguratorProgress({ current, total, label, sentence }: ProgressProps) {
  if (label === '' || sentence === '') return null

  const text = interpolate(sentence, { current: String(current), total: String(total) })
  const fraction = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0

  return (
    <Stack gap={2} aria-label={label}>
      <Text size="sm" tone="secondary">
        {text}
      </Text>
      <div className="h-px w-full bg-line" aria-hidden="true">
        <div
          className="h-px bg-ink transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </Stack>
  )
}
