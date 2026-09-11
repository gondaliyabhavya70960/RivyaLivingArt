'use client'

import { useActionState } from 'react'

import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { LibraryPair } from '@/lib/media/library-check'

/**
 * RC-330 `LibraryCheckPanel` — the one client island on the similarity page.
 *
 * It exists because a run's result is returned to the caller and stored nowhere (the pairs
 * table holds research hashes only), so the only place the pairs can be shown is the response
 * to the form that asked. `useActionState` carries it; there is no other state here.
 */

export type LibraryCheckState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'done'
      readonly runId: string
      readonly hashed: number
      readonly compared: number
      readonly exact: number
      readonly pairs: readonly LibraryPair[]
    }

export const IDLE_LIBRARY_CHECK: LibraryCheckState = { status: 'idle' }

export function LibraryCheckPanel({
  action,
  labels,
}: {
  readonly action: (state: LibraryCheckState, form: FormData) => Promise<LibraryCheckState>
  readonly labels: {
    readonly button: string
    readonly help: string
    readonly running: string
    readonly done: string
    readonly noPairs: string
    readonly pairsHeading: string
    readonly distance: string
    readonly exact: string
    readonly compared: string
  }
}) {
  const [state, submit, pending] = useActionState(action, IDLE_LIBRARY_CHECK)
  return (
    <Stack gap={3} data-library-check="">
      <form action={submit}>
        <Stack gap={2}>
          <Text size="sm" tone="secondary">
            {labels.help}
          </Text>
          <div>
            <Button type="submit" variant="primary" disabled={pending} data-run-library-check="">
              {pending ? labels.running : labels.button}
            </Button>
          </div>
        </Stack>
      </form>
      {state.status === 'error' ? (
        <Text size="sm" tone="secondary" data-library-check-error="">
          {state.message}
        </Text>
      ) : null}
      {state.status === 'done' ? (
        <Stack gap={2} data-library-check-result={state.runId}>
          <Text size="sm">
            {`${labels.done}: ${String(state.hashed)} hashed, ${String(state.compared)} ${labels.compared}, ${String(state.pairs.length)} pairs, ${String(state.exact)} ${labels.exact}.`}
          </Text>
          {state.pairs.length === 0 ? (
            <Text size="sm" tone="secondary" data-library-no-pairs="">
              {labels.noPairs}
            </Text>
          ) : (
            <Stack gap={1}>
              <Text size="sm" as="span">
                {labels.pairsHeading}
              </Text>
              <ul className="m-0 list-none p-0">
                {state.pairs.map((pair) => (
                  <li
                    key={`${pair.leftId} ${pair.rightId}`}
                    className="border-line flex flex-wrap items-center gap-2 border-t py-2"
                    data-library-pair={pair.band}
                  >
                    <Badge tone={pair.band === 'NEAR_DUPLICATE' ? 'warning' : 'neutral'}>
                      {pair.band}
                    </Badge>
                    <Text size="sm" as="span">
                      {pair.leftLabel}
                    </Text>
                    <Text size="sm" as="span" tone="secondary">
                      ·
                    </Text>
                    <Text size="sm" as="span">
                      {pair.rightLabel}
                    </Text>
                    <Text size="xs" as="span" tone="secondary">
                      {pair.exact
                        ? labels.exact
                        : `${labels.distance} ${String(pair.distance ?? '—')}`}
                    </Text>
                  </li>
                ))}
              </ul>
            </Stack>
          )}
        </Stack>
      ) : null}
    </Stack>
  )
}
