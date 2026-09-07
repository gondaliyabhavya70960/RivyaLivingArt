import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Eyebrow } from './index'

describe('Eyebrow', () => {
  it('never enters the document outline, however much it looks like a kicker', () => {
    render(
      <>
        <Eyebrow>Collections</Eyebrow>
        <h2>Resin and Walnut</h2>
      </>,
    )
    expect(screen.getByText('Collections')).toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('heading')).toHaveTextContent('Resin and Walnut')
  })

  it('keeps the editor’s sentence case in the DOM, because the caps are CSS', () => {
    render(<Eyebrow>Large format</Eyebrow>)
    expect(screen.getByText('Large format')).toBeInTheDocument()
    expect(screen.queryByText('LARGE FORMAT')).not.toBeInTheDocument()
  })

  it('can name the region it labels when given an id', () => {
    render(
      <article aria-labelledby="journal-category">
        <Eyebrow id="journal-category">Process notes</Eyebrow>
      </article>,
    )
    expect(screen.getByRole('article', { name: 'Process notes' })).toBeInTheDocument()
  })

  it('renders inline where a card needs it to', () => {
    const ref = { current: null as HTMLElement | null }
    render(
      <Eyebrow as="span" ref={ref} size="2xs" tone="accent">
        One of one
      </Eyebrow>,
    )
    expect(ref.current?.tagName).toBe('SPAN')
  })
})
