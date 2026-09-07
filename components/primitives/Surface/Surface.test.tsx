import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Surface } from './index'

/**
 * The `rv-surface-raised-2` assertions below are the one place a class name is asserted
 * in this suite, and it is not a styling assertion. That class IS the contract: §2.11
 * declares the automatic ink step-ups as descendant rules on it, so an element painted
 * with the raised-2 background but missing the class drops `--rv-ink-tertiary` and DEEP's
 * `--rv-ink-accent` below AA for everything nested inside it, silently. The class is
 * behaviour that no rendered pixel in jsdom can stand in for.
 */
describe('Surface', () => {
  it('marks the second raised surface so the §2.11 ink step-up reaches its descendants', () => {
    render(
      <Surface level={2} data-testid="popover">
        <span>Kiln-fired resin</span>
      </Surface>,
    )
    expect(screen.getByTestId('popover').classList.contains('rv-surface-raised-2')).toBe(true)
  })

  it('marks level 3 too, since a dialog is the same surface as a popover', () => {
    render(<Surface level={3} data-testid="dialog" />)
    expect(screen.getByTestId('dialog').classList.contains('rv-surface-raised-2')).toBe(true)
  })

  it.each([0, 1] as const)(
    'leaves level %i unmarked, so nested ink keeps its ground-level values',
    (level) => {
      render(<Surface level={level} data-testid="panel" />)
      expect(screen.getByTestId('panel').classList.contains('rv-surface-raised-2')).toBe(false)
    },
  )

  it('defaults to the flat, unmarked level', () => {
    render(<Surface data-testid="flat" />)
    expect(screen.getByTestId('flat').classList.contains('rv-surface-raised-2')).toBe(false)
  })

  it('renders the element the caller asked for', () => {
    render(
      <Surface as="article" level={1}>
        <p>A single commissioned piece</p>
      </Surface>,
    )
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('renders a div that is not announced as anything by default', () => {
    render(<Surface data-testid="plain">Resin and walnut</Surface>)
    expect(screen.getByTestId('plain')).not.toHaveAttribute('role')
  })

  it('spreads id and aria attributes onto the element it renders', () => {
    render(
      <Surface as="section" level={1} id="materials" aria-label="Materials">
        <p>Walnut, resin, brass</p>
      </Surface>,
    )
    const region = screen.getByRole('region', { name: 'Materials' })
    expect(region).toHaveAttribute('id', 'materials')
  })

  it('forwards a ref to the DOM node so a consumer can measure or observe it', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Surface ref={ref} level={1} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('keeps a caller class alongside the classes the level owns', () => {
    render(<Surface level={2} className="product-card" data-testid="panel" />)
    const panel = screen.getByTestId('panel')
    expect(panel.classList.contains('rv-surface-raised-2')).toBe(true)
    expect(panel.classList.contains('product-card')).toBe(true)
  })
})
