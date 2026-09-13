import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StudioTopBar } from './StudioTopBar'
import { STUDIO_COMMAND_OPEN_EVENT } from './command/CommandPalette'
import type { StaffSession } from '@/lib/auth/session'

/**
 * The deployment-environment badge, which is the only part of this bar with consequences.
 *
 * It exists so nobody publishes to production believing they are on preview. Two properties carry
 * that, and both are easy to break without noticing:
 *
 *   1. It is ABSENT in production. A badge rendered everywhere becomes furniture and stops being
 *      read; its absence meaning "this is the real site" only works if it is genuinely absent.
 *   2. It names the environment and nothing else. D8 and Phase 41 forbid a Studio page displaying
 *      deployment configuration, and "just the URL too" is how that starts.
 */

/**
 * Phase A gave the bar a mobile-nav drawer and a search control, so it now needs the resolved link
 * list and their labels. A fixture rather than the real manifest: this file is about the
 * environment badge, and coupling it to the route map would make an unrelated nav change fail it.
 */
const nav = {
  home: { href: '/studio', label: 'Overview' },
  pinned: [],
  pinnedHeading: 'Pinned',
  groups: [],
} as const

const labels = {
  search: 'Search Studio',
  searchShortcut: 'Ctrl-K',
  openNav: 'Open navigation',
  closeNav: 'Close navigation',
  navDialogTitle: 'Studio navigation',
} as const

const session: StaffSession = {
  userId: '00000000-0000-4000-8000-00000000aaaa',
  email: 'staff@rivya.test',
  displayName: 'Asha',
  role: 'merchandiser',
  status: 'ACTIVE',
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the environment badge', () => {
  it('is ABSENT in production', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    render(<StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />)

    expect(screen.queryByText('Preview')).not.toBeInTheDocument()
    expect(screen.queryByText('Development')).not.toBeInTheDocument()
  })

  it('is present on preview', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    render(<StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />)
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('is present in development', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'development')
    render(<StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />)
    expect(screen.getByText('Development')).toBeInTheDocument()
  })

  it('is absent when the variable is not set at all', () => {
    // Locally there is no VERCEL_ENV. Rendering "Development" on the strength of a missing variable
    // would be inventing a fact about where this is deployed.
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '')
    const { container } = render(
      <StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />,
    )
    expect(container.textContent).not.toContain('Development')
    expect(container.textContent).not.toContain('Preview')
  })

  it('leaks no deployment configuration', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_URL', 'rivya-abc123.vercel.app')
    const { container } = render(
      <StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />,
    )

    expect(container.textContent).not.toContain('vercel.app')
    expect(container.textContent).not.toContain('abc123')
  })
})

describe('the identity area', () => {
  it('shows the role, so a missing link has an explanation', () => {
    render(<StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />)
    expect(screen.getByText('merchandiser')).toBeInTheDocument()
  })

  it('falls back from display name to email, and then to a neutral word', () => {
    const { rerender } = render(
      <StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />,
    )
    expect(screen.getByText('Asha')).toBeInTheDocument()

    rerender(
      <StudioTopBar
        session={{ ...session, displayName: null }}
        sidebarCollapsed={false}
        nav={nav}
        labels={labels}
      />,
    )
    expect(screen.getByText('staff@rivya.test')).toBeInTheDocument()

    rerender(
      <StudioTopBar
        session={{ ...session, displayName: null, email: null }}
        sidebarCollapsed={false}
        nav={nav}
        labels={labels}
      />,
    )
    expect(screen.getByText('Staff account')).toBeInTheDocument()
  })

  it('signs out with a POST, never a link', () => {
    // A GET sign-out can be fired by an <img> tag on any page. The route refuses GET; the form
    // must not offer one either.
    //
    // Selected BY ITS ACTION, not as "the first form". It was the first form until the sidebar
    // collapse control was added above it, at which point this test started asserting the wrong
    // element — and a Server Action form carries no `method` attribute, so it failed loudly rather
    // than passing against the wrong thing. A `querySelector('form')` in a component that grows is
    // a test that quietly changes its subject.
    const { container } = render(
      <StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />,
    )
    const signOut = container.querySelector('form[action="/api/auth/sign-out"]')

    expect(signOut, 'no sign-out form').not.toBeNull()
    expect(signOut?.getAttribute('method')?.toLowerCase()).toBe('post')
    expect(container.querySelector('a[href*="sign-out"]')).toBeNull()
  })

  it('offers a control to collapse the navigation, and to bring it back', () => {
    const { rerender } = render(
      <StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />,
    )
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument()

    rerender(<StudioTopBar session={session} sidebarCollapsed nav={nav} labels={labels} />)
    expect(screen.getByRole('button', { name: 'Show navigation' })).toBeInTheDocument()
  })

  it('submits the NEXT sidebar state rather than a toggle', () => {
    // Two fast clicks on a "toggle" race to opposite answers. Submitting the intended state means
    // they converge on what the person asked for.
    const { container, rerender } = render(
      <StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />,
    )
    expect(container.querySelector('input[name="collapsed"]')).toHaveValue('true')

    rerender(<StudioTopBar session={session} sidebarCollapsed nav={nav} labels={labels} />)
    expect(container.querySelector('input[name="collapsed"]')).toHaveValue('false')
  })

  /**
   * PHASE A INVERTED THIS TEST, and the inversion is the fix rather than a relaxation.
   *
   * It used to assert the bar rendered the sentence "Press Ctrl-K or Cmd-K to search" — inert text,
   * on the reasoning that a button saying "press ⌘K" would do nothing when clicked. Sound, and
   * wrong for the device Studio is actually used from: an Android phone has neither key, so search
   * had NO entry point at all there. Search is now a control, and the shortcut is a hint inside it.
   */
  it('offers search as a control, not as a sentence', () => {
    render(<StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />)

    const search = screen.getByRole('button', { name: /Search Studio/ })
    expect(search).toBeInTheDocument()
    // The shortcut still tells a keyboard user it exists — from inside the button, so it is never
    // a second tap target and never the only way in.
    expect(search).toHaveTextContent('Ctrl-K')
  })

  it('opens the command palette from a tap, without a keyboard', async () => {
    const user = userEvent.setup()
    const opened = vi.fn()
    window.addEventListener(STUDIO_COMMAND_OPEN_EVENT, opened)

    render(<StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />)
    await user.click(screen.getByRole('button', { name: /Search Studio/ }))

    expect(opened).toHaveBeenCalledTimes(1)
    window.removeEventListener(STUDIO_COMMAND_OPEN_EVENT, opened)
  })

  /**
   * The navigation on a phone. Below `lg` the rail is gone — it was a fifty-leaf stack above the
   * main landmark — and this trigger is the only way to it, which is the whole of the Phase A exit
   * criterion: Products in two taps.
   */
  it('carries a labelled trigger for the mobile navigation', () => {
    render(<StudioTopBar session={session} sidebarCollapsed={false} nav={nav} labels={labels} />)

    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
