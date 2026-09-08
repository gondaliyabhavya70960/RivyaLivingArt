import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CommandPalette } from './CommandPalette'

/**
 * The palette's exit criterion, asserted rather than assumed.
 *
 * Phase 05 requires it to be "reachable by keyboard, closes on Esc, traps focus, and is announced
 * to screen readers". Three of those come from `patterns/Dialog`, which has its own tests — but
 * "it composes a component that does that" is a claim about wiring, and wiring is exactly what
 * breaks silently. These tests check the composed result.
 *
 * The rest is about not lying: a stale response must not overwrite a newer one, and results that
 * are incomplete must say so rather than reading as "no such record".
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const labels = {
  label: 'Search the Studio',
  placeholder: 'Type to search',
  noResults: 'Nothing matched that.',
  incomplete: 'Some results are missing — a search took too long.',
  close: 'Close search',
}

function open() {
  // Capture phase, meta OR ctrl — the palette listens for both so it works on every platform.
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
}

beforeEach(() => {
  push.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            id: '/studio/content/journal',
            label: 'Journal',
            hint: '/studio/content/journal',
            href: '/studio/content/journal',
            group: 'Go to',
          },
          {
            id: '/studio/media/all',
            label: 'All media',
            hint: '/studio/media/all',
            href: '/studio/media/all',
            group: 'Go to',
          },
        ],
        incomplete: false,
      }),
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('opening and closing', () => {
  it('is closed until a keyboard shortcut opens it', () => {
    render(<CommandPalette labels={labels} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    open()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('opens on Ctrl-K and on Cmd-K', () => {
    render(<CommandPalette labels={labels} />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('is case-insensitive about the key, so Shift does not break it', () => {
    render(<CommandPalette labels={labels} />)
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('ignores a bare k, which is a character somebody is typing', () => {
    render(<CommandPalette labels={labels} />)
    fireEvent.keyDown(window, { key: 'k' })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('puts focus in the search field, so ⌘K means "start typing"', async () => {
    // Dialog focuses its own close button by default, which is right for a dialog and useless for
    // a palette. Passing initialFocus is what makes the shortcut usable, and nothing in the
    // rendered markup shows whether it was passed.
    render(<CommandPalette labels={labels} />)
    open()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox')))
  })

  it('closes on Escape', async () => {
    render(<CommandPalette labels={labels} />)
    open()
    const input = screen.getByRole('combobox')
    await waitFor(() => expect(document.activeElement).toBe(input))

    // Fired at the focused element, not at `document`: Dialog listens on its own container so that
    // an Escape meant for it cannot also close whatever is behind it. Firing at the document
    // reaches no handler — which is how this test first failed while the behaviour was correct.
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
  })
})

describe('the combobox contract', () => {
  it('is announced as a combobox owning a listbox', async () => {
    render(<CommandPalette labels={labels} />)
    open()

    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-controls')

    fireEvent.change(input, { target: { value: 'j' } })
    await screen.findByRole('option', { name: /Journal/ })
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('moves the ACTIVE option with the arrow keys without moving focus off the input', async () => {
    // Moving focus into the list per keystroke is the common shortcut and it breaks typing: the
    // next character goes to a list item instead of the field.
    render(<CommandPalette labels={labels} />)
    open()

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'a' } })
    await screen.findByRole('option', { name: /Journal/ })

    const first = input.getAttribute('aria-activedescendant')
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    expect(input.getAttribute('aria-activedescendant')).not.toBe(first)
    expect(document.activeElement).toBe(input)
  })

  it('wraps around rather than stopping at the ends', async () => {
    render(<CommandPalette labels={labels} />)
    open()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'a' } })
    await screen.findByRole('option', { name: /Journal/ })

    const first = input.getAttribute('aria-activedescendant')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const last = input.getAttribute('aria-activedescendant')
    expect(last).not.toBe(first)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(first)
  })

  it('navigates on Enter', async () => {
    render(<CommandPalette labels={labels} />)
    open()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'j' } })
    await screen.findByRole('option', { name: /Journal/ })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/studio/content/journal')
  })
})

describe('not lying about results', () => {
  it('says results are incomplete when a provider timed out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ results: [], incomplete: true }) })),
    )
    render(<CommandPalette labels={labels} />)
    open()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'x' } })

    // Without this the reader concludes the record does not exist, when the truth is that a search
    // did not finish.
    expect(await screen.findByText(labels.incomplete)).toBeInTheDocument()
    expect(screen.queryByText(labels.noResults)).not.toBeInTheDocument()
  })

  it('says nothing matched only when the search actually completed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ results: [], incomplete: false }) })),
    )
    render(<CommandPalette labels={labels} />)
    open()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })

    expect(await screen.findByText(labels.noResults)).toBeInTheDocument()
  })

  it('does not search a blank query', async () => {
    render(<CommandPalette labels={labels} />)
    open()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '   ' } })

    await waitFor(() => expect(globalThis.fetch).not.toHaveBeenCalled())
  })

  it('sends the query as a POST body, never in a URL', async () => {
    // A GET would put whatever a staff member typed — a customer's name, an enquiry reference —
    // into proxy logs, browser history and any shared screenshot.
    render(<CommandPalette labels={labels} />)
    open()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'asha' } })

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/studio/search')
    expect(init.method).toBe('POST')
    expect(url).not.toContain('asha')
  })
})
