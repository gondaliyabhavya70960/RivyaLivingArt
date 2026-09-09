'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { summariseAnswers, type ResolvedForm } from '@/lib/cms/forms'

import type { ConfiguratorCopy } from './types'

/**
 * The last screen: everything the visitor said, and nothing else.
 *
 * THERE IS NO TOTAL, NO ESTIMATE AND NO PRICE, and there is nothing to compute one from. FEAT §15
 * says it outright — do not calculate fake bespoke pricing — and this is the screen where the
 * temptation would land, because it is the one that looks like a summary of an order.
 * `summariseAnswers` returns labels and answers; no field carries a number that means money,
 * because no column exists to hold one, and `no-pricing.test.ts` reads this directory.
 *
 * UNANSWERED FIELDS ARE ABSENT, NOT BLANK. Most of the brief is optional; a review listing eight
 * empty rows would tell a visitor only that the form was long. The point of the screen is to show
 * what they actually said before they send it.
 *
 * EACH GROUP CAN BE EDITED IN PLACE. "Edit" returns to that step rather than restarting, which is
 * what makes an eleven-step form survive somebody spotting a typo on the last screen.
 */

export interface ReviewProps {
  readonly form: ResolvedForm
  readonly answers: Readonly<Record<string, unknown>>
  readonly copy: ConfiguratorCopy
  /** Jump back to the step with this key. */
  readonly onEdit: (stepKey: string) => void
}

export function ConfiguratorReview({ form, answers, copy, onEdit }: ReviewProps) {
  const lines = summariseAnswers(form, answers)

  const byStep = new Map<string, { title: string; lines: typeof lines }>()
  for (const line of lines) {
    const group = byStep.get(line.stepKey)
    if (group === undefined) {
      byStep.set(line.stepKey, { title: line.stepTitle, lines: [line] })
    } else {
      group.lines = [...group.lines, line]
    }
  }

  return (
    <Stack gap={6}>
      <Heading level={2}>{copy.review}</Heading>

      {byStep.size === 0 ? (
        <Text tone="secondary">{copy.reviewEmpty}</Text>
      ) : (
        <Stack gap={6}>
          {[...byStep.entries()].map(([stepKey, group]) => (
            <Stack key={stepKey} gap={3}>
              <Cluster gap={3} align="center" justify="between">
                <Heading level={3} size="display-xs">
                  {group.title}
                </Heading>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    onEdit(stepKey)
                  }}
                >
                  {copy.reviewEdit}
                </Button>
              </Cluster>

              {/* A description list, because that is what this is: a term and its value. A table
                  would claim a second dimension the data does not have. */}
              <dl className="grid gap-2">
                {group.lines.map((line) => (
                  <div key={line.fieldKey} className="grid gap-1 sm:grid-cols-[1fr_2fr] sm:gap-4">
                    <dt>
                      <Text size="sm" tone="secondary">
                        {line.label}
                      </Text>
                    </dt>
                    <dd>
                      <Text size="sm">{line.value}</Text>
                    </dd>
                  </div>
                ))}
              </dl>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
