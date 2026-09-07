import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Heading, HeadingHighlight } from './index'

describe('Heading', () => {
  it('exposes every level as a real heading of that level', () => {
    render(
      <>
        <Heading level={1}>Living Art</Heading>
        <Heading level={2}>Collections</Heading>
        <Heading level={3}>Resin and Walnut</Heading>
        <Heading level={4}>Dimensions</Heading>
        <Heading level={5}>Finish</Heading>
        <Heading level={6}>Care</Heading>
      </>,
    )
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      expect(screen.getByRole('heading', { level })).toBeInTheDocument()
    }
  })

  it('keeps the level it was given when the visual size says otherwise', () => {
    render(
      <Heading level={3} size="display-2xl">
        A Table That Holds Light
      </Heading>,
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'A Table That Holds Light' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('puts the highlight run inside the heading, so it is part of the accessible name', () => {
    render(
      <Heading level={2} highlight="Living Art">
        Sculpted
      </Heading>,
    )
    expect(screen.getByRole('heading', { name: 'Sculpted Living Art' })).toBeInTheDocument()
    // One heading, not two: an accent never becomes its own level in the outline.
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })

  it('accepts a highlight composed mid-sentence without adding a heading', () => {
    render(
      <Heading level={2}>
        Made <HeadingHighlight>once</HeadingHighlight> for one room
      </Heading>,
    )
    expect(screen.getByRole('heading', { name: 'Made once for one room' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })

  it('forwards attributes so a heading can name the region it opens', () => {
    render(
      <section aria-labelledby="collections-heading">
        <Heading level={2} id="collections-heading">
          Collections
        </Heading>
      </section>,
    )
    expect(screen.getByRole('region', { name: 'Collections' })).toBeInTheDocument()
  })

  it('exposes the DOM node to a consumer that needs to measure or observe it', () => {
    const ref = { current: null as HTMLHeadingElement | null }
    render(
      <Heading level={1} ref={ref}>
        Large Format
      </Heading>,
    )
    expect(ref.current?.tagName).toBe('H1')
  })
})
