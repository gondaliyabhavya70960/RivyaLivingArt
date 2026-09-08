import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StudioTopBar } from './StudioTopBar'
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
    render(<StudioTopBar session={session} sidebarCollapsed={false} />)

    expect(screen.queryByText('Preview')).not.toBeInTheDocument()
    expect(screen.queryByText('Development')).not.toBeInTheDocument()
  })

  it('is present on preview', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('is present in development', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'development')
    render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    expect(screen.getByText('Development')).toBeInTheDocument()
  })

  it('is absent when the variable is not set at all', () => {
    // Locally there is no VERCEL_ENV. Rendering "Development" on the strength of a missing variable
    // would be inventing a fact about where this is deployed.
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '')
    const { container } = render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    expect(container.textContent).not.toContain('Development')
    expect(container.textContent).not.toContain('Preview')
  })

  it('leaks no deployment configuration', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_URL', 'rivya-abc123.vercel.app')
    const { container } = render(<StudioTopBar session={session} sidebarCollapsed={false} />)

    expect(container.textContent).not.toContain('vercel.app')
    expect(container.textContent).not.toContain('abc123')
  })
})

describe('the identity area', () => {
  it('shows the role, so a missing link has an explanation', () => {
    render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    expect(screen.getByText('merchandiser')).toBeInTheDocument()
  })

  it('falls back from display name to email, and then to a neutral word', () => {
    const { rerender } = render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    expect(screen.getByText('Asha')).toBeInTheDocument()

    rerender(<StudioTopBar session={{ ...session, displayName: null }} sidebarCollapsed={false} />)
    expect(screen.getByText('staff@rivya.test')).toBeInTheDocument()

    rerender(
      <StudioTopBar
        session={{ ...session, displayName: null, email: null }}
        sidebarCollapsed={false}
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
    const { container } = render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    const signOut = container.querySelector('form[action="/api/auth/sign-out"]')

    expect(signOut, 'no sign-out form').not.toBeNull()
    expect(signOut?.getAttribute('method')?.toLowerCase()).toBe('post')
    expect(container.querySelector('a[href*="sign-out"]')).toBeNull()
  })

  it('offers a control to collapse the navigation, and to bring it back', () => {
    const { rerender } = render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument()

    rerender(<StudioTopBar session={session} sidebarCollapsed />)
    expect(screen.getByRole('button', { name: 'Show navigation' })).toBeInTheDocument()
  })

  it('submits the NEXT sidebar state rather than a toggle', () => {
    // Two fast clicks on a "toggle" race to opposite answers. Submitting the intended state means
    // they converge on what the person asked for.
    const { container, rerender } = render(
      <StudioTopBar session={session} sidebarCollapsed={false} />,
    )
    expect(container.querySelector('input[name="collapsed"]')).toHaveValue('true')

    rerender(<StudioTopBar session={session} sidebarCollapsed />)
    expect(container.querySelector('input[name="collapsed"]')).toHaveValue('false')
  })

  it('tells people the keyboard shortcut exists', () => {
    // A shortcut nobody is told about is a shortcut only its author uses.
    render(<StudioTopBar session={session} sidebarCollapsed={false} />)
    expect(screen.getByText(/Ctrl-K or Cmd-K/)).toBeInTheDocument()
  })
})
