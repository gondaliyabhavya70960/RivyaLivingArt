'use client'

import * as React from 'react'

import { Text } from '@/components/primitives/Text'

/**
 * "Copy brief to master plan" — the Gaps tab's one action.
 *
 * IT COPIES TO THE CLIPBOARD; IT DOES NOT WRITE THE DOCUMENT. `HIGGSFIELD_MASTER_ASSET_PLAN.md`
 * is hand-written, lives in git, and is reviewed in a pull request — that is what makes a brief a
 * decision rather than a form submission. A Studio button that appended to it would route a
 * generation decision around code review, and the one thing a brief must survive is somebody
 * else reading it.
 *
 * SO THE SKELETON ARRIVES WITH ITS JUDGEMENTS BLANK. `briefSkeleton()` fills in what is derivable
 * — the compliant asset ID, the ratios, how many candidates the library already holds — and
 * leaves the prompt, the four gate answers and the alt text as TODO. Prefilling those with
 * something plausible is exactly how a brief gets approved without anyone having answered "does
 * something existing already fit?", which is the only question the gate exists to ask.
 */
export function CopyBriefButton({
  brief,
  label,
  copiedLabel,
  failedLabel,
}: {
  /** The markdown skeleton, built on the server by `briefSkeleton()`. */
  brief: string
  /** Resolved copy. Never a literal at the call site. */
  label: string
  copiedLabel: string
  failedLabel: string
}) {
  const [state, setState] = React.useState<'idle' | 'copied' | 'failed'>('idle')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-sm underline underline-offset-4"
        onClick={() => {
          // The DOM types declare `navigator.clipboard` as always present; the browser does not.
          // It is undefined on an insecure origin, and `writeText` rejects when the permission is
          // denied. Both are ordinary, and both must say so rather than appearing to succeed — a
          // reader who pastes nothing into the plan has silently lost the brief.
          const clipboard = navigator.clipboard as Clipboard | undefined
          if (clipboard === undefined) {
            setState('failed')
            return
          }
          void clipboard
            .writeText(brief)
            .then(() => {
              setState('copied')
            })
            .catch(() => {
              setState('failed')
            })
        }}
      >
        <Text as="span" size="sm">
          {label}
        </Text>
      </button>

      {/* Polite rather than assertive: the result is a confirmation, not an interruption, and
          `role="status"` announces it without cutting off whatever is being read. */}
      <Text as="span" size="xs" tone="tertiary" role="status">
        {state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : ''}
      </Text>
    </div>
  )
}
