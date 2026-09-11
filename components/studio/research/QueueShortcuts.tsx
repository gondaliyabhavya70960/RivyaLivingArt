'use client'

import * as React from 'react'

import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'

/**
 * `j` `k` to move, `s` `i` `r` `n` to act.
 *
 * **THE ONE CLIENT COMPONENT ON THIS SCREEN, AND IT EARNS IT.** Everything else in the change queue
 * is a Server Component with plain forms; this exists because the surface is one somebody works
 * through a hundred rows at a time, and reaching for the mouse between every row is the difference
 * between a queue that gets cleared and one that does not. That is the "named reason" the house
 * rule asks for before `'use client'`.
 *
 * IT DRIVES THE EXISTING CONTROLS, IT DOES NOT DUPLICATE THEM. `j` and `k` move focus between the
 * row links the server rendered; `s`, `i`, `r` and `n` click the buttons in the open drawer. So
 * there is exactly one implementation of each action — the form — and the keyboard is a second way
 * to reach it rather than a second path to the same Server Action. A shortcut that posted directly
 * would be the one that skips the required-reason field.
 *
 * IT NEVER FIRES WHILE SOMEBODY IS TYPING. `i` is "ignore" on the queue and a letter in the middle
 * of a reason, and a shortcut that swallowed it would make the reason field unusable — which is
 * how a required-reason design quietly becomes a field people paste a full stop into.
 */

const ROW_SELECTOR = '[data-change-link]'

/** Which button each key presses, by the `data-action` the drawer stamps on it. */
const ACTION_KEYS: Readonly<Record<string, string>> = {
  s: 'shortlist',
  i: 'ignore',
  r: 'reject',
  n: 'note',
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.closest('[role="dialog"] input, [role="dialog"] textarea') !== null
  )
}

export function QueueShortcuts() {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target)) return

      const key = event.key.toLowerCase()

      if (key === 'j' || key === 'k') {
        const rows = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)]
        if (rows.length === 0) return
        const active = document.activeElement
        const index = rows.findIndex((row) => row === active || row.contains(active))
        // FROM NOWHERE, `j` GOES TO THE FIRST ROW AND `k` TO THE LAST. Wrapping instead would send
        // somebody who pressed `k` by accident to the bottom of a hundred rows.
        const next =
          index === -1
            ? key === 'j'
              ? 0
              : rows.length - 1
            : Math.min(Math.max(index + (key === 'j' ? 1 : -1), 0), rows.length - 1)
        rows[next]?.focus()
        event.preventDefault()
        return
      }

      const action = ACTION_KEYS[key]
      if (action === undefined) return

      const button = document.querySelector<HTMLButtonElement>(
        `[data-change-drawer] [data-action="${action}"]`,
      )
      if (button === null) return

      /*
       * A REASON-BEARING ACTION FOCUSES ITS FIELD RATHER THAN SUBMITTING.
       *
       * `i` and `r` need a reason and the form will refuse without one, so pressing the key
       * submits an empty form and shows a validation message — which trains people to ignore
       * validation messages. Putting the cursor in the field is what the person meant: they said
       * "ignore this", and the next thing to happen is that they type why.
       */
      const form = button.closest('form')
      const reason = form?.querySelector<HTMLInputElement>(
        'input[name="reason"], input[name="body"]',
      )
      if (reason !== null && reason !== undefined && reason.value.trim() === '') {
        reason.focus()
      } else {
        button.click()
      }
      event.preventDefault()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // ANNOUNCED, NOT HIDDEN. A shortcut nobody knows about is a shortcut nobody uses, and a screen
  // reader user needs to be told the keys exist as much as anybody.
  return (
    <Text size="xs" tone="secondary" data-queue-shortcuts="">
      {t('studio.research.shortcuts')}
    </Text>
  )
}
