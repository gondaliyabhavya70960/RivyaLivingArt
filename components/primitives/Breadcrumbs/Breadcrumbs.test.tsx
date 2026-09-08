import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Breadcrumbs } from './index'

/**
 * Labels here stand in for `global_content` and the entity rows a real trail is built
 * from; the component itself contains no copy.
 *
 * The below-430px rule (§8.4) drops ancestors in CSS, so it is invisible to jsdom, which
 * runs with `css: false`. It is asserted at the QA widths in the Playwright suite; what is
 * asserted here is the structure and the semantics that survive at every width.
 */
const TRAIL = [
  { label: 'Home', href: '/' },
  { label: 'Collection', href: '/collection' },
  { label: 'Dining tables', href: '/collection/dining-tables' },
  { label: 'Walnut river console', href: '/product/walnut-river-console' },
]

describe('Breadcrumbs', () => {
  it('is a navigation landmark named by the caller', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={TRAIL} />)
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
  })

  it('exposes one list item per step, in trail order', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={TRAIL} />)
    const steps = within(screen.getByRole('navigation')).getAllByRole('listitem')
    expect(steps.map((step) => step.textContent)).toEqual([
      'Home',
      'Collection',
      'Dining tables',
      'Walnut river console',
    ])
  })

  it('marks the last step as the current page and does not make it a link', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={TRAIL} />)
    expect(screen.getByText('Walnut river console')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Walnut river console' })).not.toBeInTheDocument()
  })

  it('links every ancestor at its own href and nothing else', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={TRAIL} />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/collection',
      '/collection/dining-tables',
    ])
  })

  it('walks the ancestors in order under Tab and stops at the current page', async () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={TRAIL} />)
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Collection' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Dining tables' })).toHaveFocus()
    await userEvent.tab()
    // Past the last ancestor: the current page is text, so focus leaves the trail.
    for (const link of screen.getAllByRole('link')) expect(link).not.toHaveFocus()
  })

  it('renders a single-step trail as the current page alone', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={[{ label: 'Studio', href: '/studio' }]} />)
    expect(screen.getByText('Studio')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders no landmark at all when there is no trail', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={[]} />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('keeps the separators out of the accessible tree', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={TRAIL} />)
    // Every accessible name is exactly its label: a separator reaching the tree would
    // append itself to the name of the item it follows.
    expect(screen.getByRole('link', { name: 'Collection' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toHaveAccessibleName('Breadcrumb')
  })

  it('spreads consumer attributes onto the nav', () => {
    render(<Breadcrumbs aria-label="Breadcrumb" items={TRAIL} id="studio-trail" />)
    expect(screen.getByRole('navigation')).toHaveAttribute('id', 'studio-trail')
  })
})
