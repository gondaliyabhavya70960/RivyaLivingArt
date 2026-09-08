import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Divider } from './index'

describe('Divider', () => {
  it('is invisible to assistive tech when it is only punctuation', () => {
    render(<Divider />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('is announced as a separator when it is the only mark of a new subject', () => {
    render(<Divider decorative={false} />)
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('states its orientation when a semantic rule runs vertically', () => {
    render(<Divider decorative={false} orientation="vertical" />)
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('leaves a decorative vertical rule out of the tree rather than describing it', () => {
    render(<Divider orientation="vertical" />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('forwards attributes and its DOM node', () => {
    const ref = { current: null as HTMLHRElement | null }
    render(<Divider ref={ref} decorative={false} data-section="meta" />)
    const rule = screen.getByRole('separator')
    expect(rule).toHaveAttribute('data-section', 'meta')
    expect(ref.current).toBe(rule)
  })
})
