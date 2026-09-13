import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeafIndex } from './LeafIndex'
import { STUDIO_NAV } from '@/lib/auth/studio-nav'
import { roleHasPermission } from '@/lib/auth/permissions'

/**
 * §9's Phase E instruction has two halves and the second one is the load-bearing half: "Dashboard
 * groups leaves … **Do not hide leaves — group them.**"
 *
 * WHY THE COVERAGE TEST IS THE ONE THAT MATTERS. Grouping is easy to get visually right and quietly
 * wrong: the guide names ten of the fifteen research leaves, so a tidy three-column index that
 * listed only those ten would look finished and would have hidden five real screens. This asserts
 * against the manifest rather than against a list written here, so a leaf added later cannot fall
 * out silently.
 */

const RESEARCH = STUDIO_NAV.find((group) => group.id === 'research')?.leaves ?? []
const SELF = '/studio/research/dashboard'

describe('LeafIndex', () => {
  it('lists every research leaf the role may open, minus the page you are on', () => {
    render(<LeafIndex role="owner" />)

    const expected = RESEARCH.filter((leaf) => leaf.href !== SELF)
    // Sanity: the manifest really does carry more leaves than the guide's three groups name.
    expect(expected.length).toBeGreaterThan(10)

    const hrefs = screen.getAllByRole('link').map((node) => node.getAttribute('href'))
    for (const leaf of expected) {
      expect(hrefs, `${leaf.href} must not be hidden`).toContain(leaf.href)
    }
    expect(hrefs).not.toContain(SELF)
  })

  it('puts the three named groups in the order the work happens', () => {
    const { container } = render(<LeafIndex role="owner" />)
    const groups = [...container.querySelectorAll('[data-research-group]')].map((node) =>
      node.getAttribute('data-research-group'),
    )
    expect(groups.slice(0, 3)).toEqual([
      'studio.research.groupSetup',
      'studio.research.groupQueue',
      'studio.research.groupAnalysis',
    ])
  })

  it('gathers the leaves the guide does not name rather than dropping them', () => {
    const { container } = render(<LeafIndex role="owner" />)
    const fourth = container.querySelector('[data-research-group="studio.research.groupDecisions"]')
    expect(fourth).not.toBeNull()
    expect(fourth?.querySelectorAll('a').length).toBeGreaterThan(0)
  })

  it('hides a leaf a role cannot open, which is the sidebar’s own rule', () => {
    // The editor holds no research permission at all, so there is nothing to arrange.
    expect(roleHasPermission('editor', 'research.read')).toBe(false)
    const { container } = render(<LeafIndex role="editor" />)
    expect(container.querySelector('[data-research-leaf-index]')).toBeNull()
  })

  it('gives every row the 44px target', () => {
    render(<LeafIndex role="owner" />)
    for (const link of screen.getAllByRole('link')) {
      // jsdom computes no layout; the class that produces 44px is what can be checked here.
      expect(link.className).toContain('min-h-11')
    }
  })
})
