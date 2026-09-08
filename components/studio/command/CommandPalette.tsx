'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { Dialog } from '@/components/patterns/Dialog'
import type { CommandResult } from './registry'

/**
 * ⌘K / Ctrl-K: jump anywhere in the Studio.
 *
 * IT COMPOSES `patterns/Dialog`, so the focus trap, Escape, focus restoration and scroll lock are
 * the ones Phase 02 already built and tested. What is here is the listbox and the fetching.
 *
 * THE COMBOBOX PATTERN IS IMPLEMENTED PROPERLY OR NOT AT ALL. The input keeps focus and owns the
 * arrow keys; the active option is announced through `aria-activedescendant` rather than by moving
 * focus into the list. Moving focus per keystroke is the common shortcut and it breaks typing —
 * the reader's next character goes to a list item instead of the field.
 *
 * EVERY SEARCH CANCELS THE ONE BEFORE IT. Without that, responses race: a slow reply for "pr"
 * arriving after a fast one for "products" overwrites the correct results with stale ones, and it
 * looks like the palette ignoring what was typed.
 *
 * INCOMPLETE RESULTS SAY SO. If a provider timed out the palette shows a line saying results are
 * missing, because the alternative is a reader concluding a record does not exist.
 */
export function CommandPalette({
  labels,
}: {
  /** Resolved copy, passed in: this is a Client Component and `t()` reads a server-side map. */
  labels: {
    label: string
    placeholder: string
    noResults: string
    incomplete: string
    close: string
  }
}) {
  const router = useRouter()
  const listId = useId()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CommandResult[]>([])
  const [incomplete, setIncomplete] = useState(false)
  const [active, setActive] = useState(0)

  const inFlight = useRef<AbortController | null>(null)

  /**
   * Where focus lands when the palette opens.
   *
   * WITHOUT THIS, ⌘K OPENS THE PALETTE AND YOU CANNOT TYPE. `patterns/Dialog` focuses its own first
   * focusable element by default, which is the close button — reasonable for a dialog, useless for
   * a command palette, where typing immediately IS the interaction. A test caught it; nothing about
   * the rendered markup looks wrong.
   *
   * It is also what makes Escape work. Dialog handles Escape via `onKeyDown` on its own container
   * rather than a document listener — deliberately, so an Escape meant for this dialog cannot also
   * close whatever is behind it — so the key only reaches it when focus is inside.
   */
  const inputRef = useRef<HTMLInputElement>(null)

  // ⌘K on macOS, Ctrl-K elsewhere. Capture-phase so it works from inside a form field, and
  // preventDefault because Ctrl-K is "focus the address bar" in some browsers.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      setOpen((wasOpen) => !wasOpen)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])

  const search = useCallback(async (value: string) => {
    inFlight.current?.abort()
    if (value.trim() === '') {
      setResults([])
      setIncomplete(false)
      return
    }

    const controller = new AbortController()
    inFlight.current = controller

    try {
      const response = await fetch('/api/studio/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: value }),
        signal: controller.signal,
      })
      if (!response.ok) {
        setResults([])
        setIncomplete(true)
        return
      }
      const data = (await response.json()) as { results: CommandResult[]; incomplete: boolean }
      setResults(data.results)
      setIncomplete(data.incomplete)
      setActive(0)
    } catch {
      // An abort lands here too. Leaving the previous results in place is correct for that case —
      // another request is already running — and harmless for a genuine failure, which the
      // `incomplete` line from a non-ok response already covers.
    }
  }, [])

  function onKeyDown(event: React.KeyboardEvent) {
    if (results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      const chosen = results[active]
      if (chosen === undefined) return
      event.preventDefault()
      setOpen(false)
      router.push(chosen.href as Parameters<typeof router.push>[0])
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={labels.label}
      closeLabel={labels.close}
      initialFocus={inputRef}
      size="md"
    >
      <Stack gap={3}>
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results[active] === undefined ? undefined : `${listId}-${active}`}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={labels.placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            void search(event.target.value)
          }}
          onKeyDown={onKeyDown}
        />

        {incomplete && (
          <Text size="xs" tone="secondary">
            {labels.incomplete}
          </Text>
        )}

        {query.trim() !== '' && results.length === 0 && !incomplete && (
          <Text size="sm" tone="secondary">
            {labels.noResults}
          </Text>
        )}

        <ul id={listId} role="listbox" aria-label={labels.label} className="list-none p-0">
          {results.map((result, index) => (
            <li
              key={`${result.group}:${result.id}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'bg-surface-raised-2 rounded-sm' : undefined}
            >
              <button
                type="button"
                className="w-full rounded-sm px-3 py-2 text-left"
                onClick={() => {
                  setOpen(false)
                  router.push(result.href as Parameters<typeof router.push>[0])
                }}
              >
                <Text as="span" size="sm">
                  {result.label}
                </Text>
                {result.hint !== undefined && (
                  <Text as="span" size="xs" tone="tertiary">
                    {' '}
                    {result.hint}
                  </Text>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Stack>
    </Dialog>
  )
}
