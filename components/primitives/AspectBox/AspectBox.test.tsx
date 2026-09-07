import { describe, expect, it } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { AspectBox } from './index'

describe('AspectBox', () => {
  it('leaves the media it reserves space for in the accessible tree', () => {
    render(
      <AspectBox ratio="3:2" mobileRatio="4:5">
        <img src="/river-table.avif" alt="A resin river table lit from one side" />
      </AspectBox>,
    )
    expect(
      screen.getByRole('img', { name: 'A resin river table lit from one side' }),
    ).toBeInTheDocument()
  })

  it('can be a figure so a caption can be associated with it', () => {
    render(
      <AspectBox as="figure" ratio="16:9" aria-label="Material sequence, stage three">
        <img src="/resin-pour.avif" alt="" />
      </AspectBox>,
    )
    expect(screen.getByRole('figure', { name: 'Material sequence, stage three' })).toBeVisible()
  })

  it('spreads consumer attributes onto the reserved box', () => {
    render(
      <>
        <AspectBox
          as="figure"
          ratio="1:1"
          aria-label="Cast resin, macro"
          aria-describedby="macro-caption"
          data-slot="material-macro"
        />
        <p id="macro-caption">Photographed at 100mm.</p>
      </>,
    )
    const box = screen.getByRole('figure', { name: 'Cast resin, macro' })
    expect(box).toHaveAccessibleDescription('Photographed at 100mm.')
    expect(box).toHaveAttribute('data-slot', 'material-macro')
  })

  it('forwards its ref to the element that holds the reservation', () => {
    const ref = createRef<HTMLElement>()
    render(<AspectBox as="figure" ratio="21:9" mobileRatio="9:16" ref={ref} />)
    expect(ref.current).toBe(screen.getByRole('figure'))
  })
})
