import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('jsdom style probe', () => {
  it('stores token-referencing inline styles', () => {
    render(
      <div
        data-testid="p"
        style={{
          opacity: 0,
          transform: 'translateY(var(--rv-motion-rise-md))',
          transitionProperty: 'opacity, transform',
          transitionDuration: 'var(--rv-duration-slow)',
          transitionTimingFunction: 'var(--rv-ease-out)',
          transitionDelay: 'calc(var(--rv-motion-stagger) * 2)',
        }}
      />,
    )
    const el = screen.getByTestId('p')
    console.log('cssText:', JSON.stringify(el.getAttribute('style')))
    console.log('opacity:', JSON.stringify(el.style.opacity))
    console.log('transform:', JSON.stringify(el.style.transform))
    console.log('tProp:', JSON.stringify(el.style.transitionProperty))
    console.log('tDur:', JSON.stringify(el.style.transitionDuration))
    console.log('tFn:', JSON.stringify(el.style.transitionTimingFunction))
    console.log('tDelay:', JSON.stringify(el.style.transitionDelay))
    console.log('IO type:', typeof IntersectionObserver)
    console.log('rect:', JSON.stringify(el.getBoundingClientRect()))
    console.log('innerHeight:', window.innerHeight)
    expect(true).toBe(true)
  })
})
