import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tag } from './index'

describe('Tag', () => {
  it('makes a chip row a real list when asked to', () => {
    render(
      <ul>
        <Tag as="li">Walnut</Tag>
        <Tag as="li">Clear resin</Tag>
        <Tag as="li">Made to order</Tag>
      </ul>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('reads as part of the card it labels, rather than as its own control', () => {
    render(
      <a href="/collections/river">
        River Collection <Tag>Walnut</Tag>
      </a>,
    )
    expect(screen.getByRole('link', { name: 'River Collection Walnut' })).toBeInTheDocument()
    // A chip that filters is a button (§12.1). This one is text on a surface.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not compile without a term', () => {
    render(
      // @ts-expect-error a chip with no content is a rectangle with no meaning.
      <Tag />,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('forwards attributes and its DOM node', () => {
    const ref = { current: null as HTMLElement | null }
    render(
      <Tag ref={ref} lang="fr">
        Résine
      </Tag>,
    )
    expect(ref.current?.tagName).toBe('SPAN')
    expect(screen.getByText('Résine')).toHaveAttribute('lang', 'fr')
  })
})
