import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaFrame } from './index'

/**
 * Seeded copy, passed in as a prop the way `global_content` will pass it (SEED §1, §47).
 * The media is a stand-in: §10.1 reserves the right to emit an <img> to Phase 06's
 * MediaImage, and MediaFrame is agnostic about what it holds.
 */
const FALLBACK = 'Image temporarily unavailable'

describe('MediaFrame', () => {
  it('shows the fallback message it is given when no media resolves', () => {
    render(<MediaFrame ratio="4:5" fallbackLabel={FALLBACK} />)
    expect(screen.getByText(FALLBACK)).toBeVisible()
  })

  it('renders whatever fallback copy the caller passes, holding no string of its own', () => {
    render(<MediaFrame ratio="4:5" fallbackLabel="Beeld tijdelijk niet beschikbaar" />)
    expect(screen.getByText('Beeld tijdelijk niet beschikbaar')).toBeVisible()
    expect(screen.queryByText(FALLBACK)).not.toBeInTheDocument()
  })

  it('treats a null child as no media, so a resolver that finds nothing still falls back', () => {
    render(
      <MediaFrame ratio="16:9" fallbackLabel={FALLBACK}>
        {null}
      </MediaFrame>,
    )
    expect(screen.getByText(FALLBACK)).toBeVisible()
  })

  it('does not announce a failure when the media is there', () => {
    render(
      <MediaFrame ratio="3:2" fallbackLabel={FALLBACK}>
        <div role="img" aria-label="A resin river table in a lit gallery" />
      </MediaFrame>,
    )
    expect(screen.getByRole('img', { name: 'A resin river table in a lit gallery' })).toBeVisible()
    expect(screen.queryByText(FALLBACK)).not.toBeInTheDocument()
  })

  it('keeps the veil out of the accessible tree', () => {
    render(
      <MediaFrame
        as="figure"
        ratio="21:9"
        mobileRatio="9:16"
        veil
        fallbackLabel={FALLBACK}
        aria-label="Page hero"
        overlay={<p>Cast in one pour</p>}
      >
        <div data-testid="media" />
      </MediaFrame>,
    )
    // The frame exposes exactly the overlay copy — the veil adds no text, no role and no
    // second image to read past.
    expect(screen.getByRole('figure', { name: 'Page hero' })).toHaveTextContent(
      /^Cast in one pour$/,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('leaves a control in the overlay reachable by keyboard', async () => {
    render(
      <MediaFrame
        ratio="16:9"
        veil
        fallbackLabel={FALLBACK}
        overlay={<a href="/portfolio/atlas-table">See the full project</a>}
      >
        <div data-testid="media" />
      </MediaFrame>,
    )
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'See the full project' })).toHaveFocus()
  })

  it('passes its ratio props and consumer attributes through to the reserved box', () => {
    render(
      <MediaFrame
        as="figure"
        ratio="3:4"
        mobileRatio="4:5"
        fallbackLabel={FALLBACK}
        aria-label="Collection card media"
        data-slot="collection-hero"
      />,
    )
    expect(screen.getByRole('figure', { name: 'Collection card media' })).toHaveAttribute(
      'data-slot',
      'collection-hero',
    )
  })
})
