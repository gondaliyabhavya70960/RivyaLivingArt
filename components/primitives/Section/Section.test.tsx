import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section } from './index'

/**
 * The scheme class is asserted because it is the mechanism, not a style: §2.4 makes the
 * class on the section's own outermost element the only thing that switches the semantic
 * tokens, and a band that renders the class one level down would leave its own ground
 * painted in the previous scheme.
 */
describe('Section', () => {
  it.each([
    ['DEEP', 'rv-scheme-deep'],
    ['INK', 'rv-scheme-ink'],
    ['BONE', 'rv-scheme-bone'],
  ] as const)('declares the %s scheme on its own outermost element', (scheme, className) => {
    render(<Section scheme={scheme} data-testid="band" />)
    expect(screen.getByTestId('band').classList.contains(className)).toBe(true)
  })

  it('declares no scheme of its own when none is given, so the shell scheme is inherited', () => {
    render(<Section data-testid="band" />)
    const classes = screen.getByTestId('band').className
    expect(classes).not.toMatch(/rv-scheme-/)
  })

  it.each([
    ['sm', 'var(--rv-section-y-sm)'],
    ['md', 'var(--rv-section-y-md)'],
    ['lg', 'var(--rv-section-y-lg)'],
    ['xl', 'var(--rv-section-y-xl)'],
  ] as const)('takes its %s vertical rhythm from the §5.1 token', (spacing, token) => {
    render(<Section spacing={spacing} data-testid="band" />)
    expect(screen.getByTestId('band').style.paddingBlock).toBe(token)
  })

  it('defaults to the lg rhythm §5.1 names as the default', () => {
    render(<Section data-testid="band" />)
    expect(screen.getByTestId('band').style.paddingBlock).toBe('var(--rv-section-y-lg)')
  })

  it('becomes a named region when the caller labels it', () => {
    render(
      <Section scheme="BONE" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Commission questions</h2>
      </Section>,
    )
    expect(screen.getByRole('region', { name: 'Commission questions' })).toBeInTheDocument()
  })

  it('renders the element the caller asked for', () => {
    render(
      <Section as="footer" spacing="sm">
        <p>Rivya Living Art</p>
      </Section>,
    )
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('forwards a ref to the DOM node', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Section ref={ref} />)
    expect(ref.current?.tagName).toBe('SECTION')
  })
})
