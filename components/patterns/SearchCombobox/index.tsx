'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { interpolate } from '@/lib/cms/strings'
import { cn } from '@/lib/ui/cn'

import { Listbox, type SuggestionOption } from './Listbox'

/**
 * The header search box: an ARIA 1.2 combobox that degrades to a plain GET form.
 *
 * IT IS A `<form method="get" action="/search">` FIRST AND A COMBOBOX SECOND, and the order is the
 * design. With JavaScript disabled, blocked, or still downloading, the input submits to `/search`
 * and the visitor gets the full results page — the same page the "see all" option leads to. Nothing
 * here is a `<div onClick>` that stops working when the bundle fails.
 *
 * FOCUS NEVER LEAVES THE INPUT. `aria-activedescendant` names the active option while the input
 * keeps every keystroke. The alternative — moving DOM focus into the list — breaks typing and makes
 * every arrow press re-announce the whole list, and is the usual way this pattern is got wrong.
 *
 * ESCAPE RESTORES WHAT WAS TYPED. First Escape closes the list and puts back the text the visitor
 * had entered before arrowing through suggestions; a second Escape clears the field. That is the
 * WAI-ARIA behaviour and it matters here because arrowing through options does NOT overwrite the
 * input in this implementation — so the restore is a no-op in the common case and correct in the
 * one where a browser's autofill has interfered.
 *
 * TWO CHARACTERS, DEBOUNCED, AND ABORTED ON EVERY KEYSTROKE. A request per character would mean
 * five in-flight queries for `resin`, arriving out of order, with the second-to-last winning. The
 * controller is aborted before each new request so only the latest can render.
 *
 * NO COPY OF ITS OWN. Every string is a prop the server resolved from `global_content`; a literal
 * here would be a visitor-readable sentence that the owner could not change (CLAUDE.md), and
 * `cms:check-copy` fails on one.
 */

const MIN_QUERY = 2
const DEBOUNCE_MS = 160

type SuggestResponse = {
  readonly results?: ReadonlyArray<{
    readonly id?: unknown
    readonly label?: unknown
    readonly group?: unknown
    readonly href?: unknown
  }>
}

export function SearchCombobox({
  label,
  placeholder,
  submitLabel,
  listLabel,
  hint,
  seeAllLabel,
  countTemplate,
  initialQuery = '',
  className,
}: {
  readonly label: string | null
  readonly placeholder: string | null
  readonly submitLabel: string | null
  readonly listLabel: string | null
  readonly hint: string | null
  readonly seeAllLabel: string | null
  /**
   * The seeded `{{count}}` sentence the live region reads when suggestions arrive. A prop rather
   * than a literal for the reason every other string here is: the announcement is copy, and copy
   * lives in `global_content`.
   */
  readonly countTemplate: string | null
  readonly initialQuery?: string
  readonly className?: string
}): React.ReactElement {
  const router = useRouter()
  const inputId = React.useId()
  const listId = `${inputId}-listbox`
  const hintId = `${inputId}-hint`

  const [value, setValue] = React.useState(initialQuery)
  /**
   * SUGGESTIONS ARE STORED WITH THE QUERY THEY ANSWER, not on their own.
   *
   * The obvious shape is `options` plus an `open` flag, cleared by an effect when the field falls
   * below two characters — and that effect calls setState synchronously on every keystroke, which
   * the React compiler rejects because it re-renders the tree a second time before paint. Keeping
   * the query beside its results makes staleness a RENDER-TIME comparison instead: results that
   * answer a query the visitor has since edited are simply not the current results, and no state
   * has to be cleared to say so. The only setState left in the effect is inside the `.then()`,
   * where it belongs.
   */
  const [suggestions, setSuggestions] = React.useState<{
    query: string
    options: readonly SuggestionOption[]
  }>({ query: '', options: [] })
  /** Set by Escape, by blur and by picking an option. Cleared by typing. Never by an effect. */
  const [closed, setClosed] = React.useState(true)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [announcement, setAnnouncement] = React.useState('')

  const inputRef = React.useRef<HTMLInputElement>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const committedRef = React.useRef(initialQuery)

  const searchHref = React.useCallback(
    (query: string) => `/search?q=${encodeURIComponent(query)}`,
    [],
  )

  const trimmed = value.trim()

  // Results answering a query the visitor has since edited are not the current results.
  const options: readonly SuggestionOption[] =
    suggestions.query === trimmed && trimmed.length >= MIN_QUERY ? suggestions.options : []

  // The "see all" row is an option like any other for keyboard purposes, so the navigable list is
  // one longer than `options` whenever it is shown.
  const hasSeeAll = seeAllLabel !== null && trimmed.length >= MIN_QUERY
  const navigableCount = options.length + (hasSeeAll ? 1 : 0)

  // Clamped at render rather than reset by an effect: a list that shrank under the cursor has no
  // active option, and saying so here costs nothing and re-renders nothing.
  const active = activeIndex >= 0 && activeIndex < navigableCount ? activeIndex : -1
  const open = !closed && navigableCount > 0

  const activeId =
    active < 0
      ? null
      : active < options.length
        ? (options[active]?.id ?? null)
        : `${listId}-see-all`

  React.useEffect(() => {
    const query = value.trim()
    if (query.length < MIN_QUERY) {
      // Nothing to clear: `options` is derived, and a stale answer to a longer query is already
      // invisible because its stored query no longer matches what is in the field.
      abortRef.current?.abort()
      return
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      void fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
        .then((response) => (response.ok ? (response.json() as Promise<SuggestResponse>) : null))
        .then((body) => {
          if (body === null) return
          const parsed: SuggestionOption[] = []
          for (const row of body.results ?? []) {
            if (
              typeof row.id === 'string' &&
              typeof row.label === 'string' &&
              typeof row.group === 'string' &&
              typeof row.href === 'string'
            ) {
              parsed.push({ id: row.id, label: row.label, group: row.group, href: row.href })
            }
          }
          setSuggestions({ query, options: parsed })
          setClosed(false)
          setActiveIndex(-1)
          // Silent when the sentence is missing rather than announcing a bare number: a screen
          // reader saying "4" with no noun is worse than saying nothing, and the seeded row is how
          // that sentence is supposed to arrive.
          setAnnouncement(
            countTemplate === null
              ? ''
              : interpolate(countTemplate, { count: String(parsed.length), query }),
          )
        })
        .catch(() => {
          // An abort is the normal case — the visitor typed another character. A failure is not
          // worth interrupting anybody over: the form still submits and /search still works.
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [value, countTemplate])

  const go = React.useCallback(
    (href: string) => {
      setClosed(true)
      setActiveIndex(-1)
      // `as Route` because `typedRoutes` is on and this href is BUILT AT RUNTIME — a product's
      // path from the index, or `/search?q=` with whatever was typed. Neither is a literal the
      // route type can be checked against, and the same cast is what `HiggsfieldAssetDrawer` uses
      // for a return path read out of the URL. What guarantees the link works is that `url_path`
      // is written by `refresh_search_document` from the row's own slug.
      router.push(href as Route)
    },
    [router],
  )

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (navigableCount === 0) return
      event.preventDefault()
      setClosed(false)
      setActiveIndex((current) => {
        const clamped = current >= 0 && current < navigableCount ? current : -1
        const next = event.key === 'ArrowDown' ? clamped + 1 : clamped - 1
        // Wrapping, because a list you cannot leave by continuing to press the same key is a trap
        // for anybody who is not counting.
        if (next >= navigableCount) return 0
        if (next < 0) return navigableCount - 1
        return next
      })
      return
    }

    if (event.key === 'Enter') {
      if (open && active >= 0) {
        event.preventDefault()
        const href =
          active < options.length
            ? (options[active]?.href ?? searchHref(trimmed))
            : searchHref(trimmed)
        go(href)
      }
      // With no active option the form submits normally — which is the no-JavaScript path, taken
      // deliberately rather than re-implemented here.
      return
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setClosed(true)
        setActiveIndex(-1)
        setValue(committedRef.current)
        inputRef.current?.focus()
      } else if (value !== '') {
        event.preventDefault()
        setValue('')
        committedRef.current = ''
      }
    }
  }

  return (
    <div className={cn('relative', className)}>
      <form method="get" action="/search" role="search" className="flex items-center gap-2">
        {label === null ? null : (
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          name="q"
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          {...(activeId === null ? {} : { 'aria-activedescendant': activeId })}
          {...(hint === null ? {} : { 'aria-describedby': hintId })}
          {...(placeholder === null ? {} : { placeholder })}
          onChange={(event) => {
            setValue(event.target.value)
            committedRef.current = event.target.value
            setClosed(false)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setClosed(true)}
          className={cn(
            'w-full min-w-0 border border-line bg-surface px-3 py-2 text-sm text-ink',
            'placeholder:text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
        />
        {submitLabel === null ? null : (
          <button
            type="submit"
            className="shrink-0 border border-line px-3 py-2 text-sm uppercase tracking-technical text-ink-secondary hover:text-ink"
          >
            {submitLabel}
          </button>
        )}
      </form>

      {hint === null ? null : (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}

      {/* The count of suggestions, announced politely. Bare number by design — see the effect. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {open && listLabel !== null ? (
        <Listbox
          id={listId}
          options={options}
          activeId={activeId}
          label={listLabel}
          seeAllLabel={hasSeeAll ? seeAllLabel : null}
          seeAllHref={searchHref(trimmed)}
          onPick={go}
        />
      ) : null}
    </div>
  )
}
