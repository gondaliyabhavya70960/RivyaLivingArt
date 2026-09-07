import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Container } from './index'

/**
 * A container's whole job is choosing which measured width applies and paying the gutter,
 * so the assertions read the token reference it wrote — not a computed pixel value, which
 * jsdom does not resolve, and not a class name. `max-w-prose` looks like the obvious
 * implementation and silently resolves to Tailwind's own 65ch rather than §5.3's 44rem;
 * these tests are what stops that from being reintroduced.
 */
describe('Container', () => {
  it.each([
    ['prose', 'var(--rv-container-prose)'],
    ['default', 'var(--rv-container-default)'],
    ['wide', 'var(--rv-container-wide)'],
    ['full', 'var(--rv-container-full)'],
  ] as const)('constrains a %s container to the §5.3 token', (size, token) => {
    render(<Container size={size} data-testid="container" />)
    expect(screen.getByTestId('container').style.maxInlineSize).toBe(token)
  })

  it('defaults to the 75rem container the majority of sections use', () => {
    render(<Container data-testid="container" />)
    expect(screen.getByTestId('container').style.maxInlineSize).toBe('var(--rv-container-default)')
  })

  it('pays the gutter at every size, including full-bleed', () => {
    render(<Container size="full" data-testid="container" />)
    expect(screen.getByTestId('container').style.paddingInline).toBe('var(--rv-gutter)')
  })

  it('renders the landmark the caller asked for', () => {
    render(
      <Container as="main" size="prose">
        <p>The commission process</p>
      </Container>,
    )
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('spreads id and aria attributes onto the element it renders', () => {
    render(
      <Container as="nav" aria-label="Journal categories" id="journal-nav">
        <a href="/journal">Journal</a>
      </Container>,
    )
    expect(screen.getByRole('navigation', { name: 'Journal categories' })).toHaveAttribute(
      'id',
      'journal-nav',
    )
  })

  it('lets a caller add to the style it sets without losing the width or the gutter', () => {
    render(<Container size="wide" style={{ position: 'relative' }} data-testid="container" />)
    const el = screen.getByTestId('container')
    expect(el.style.position).toBe('relative')
    expect(el.style.maxInlineSize).toBe('var(--rv-container-wide)')
    expect(el.style.paddingInline).toBe('var(--rv-gutter)')
  })

  it('forwards a ref to the DOM node', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Container ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
