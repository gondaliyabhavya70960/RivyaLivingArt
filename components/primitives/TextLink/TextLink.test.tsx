import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextLink } from './index'

/**
 * The "opens in a new tab" sentence is a `global_content` string rendered once per page,
 * which is why the component takes an id and never the sentence. The fixture stands in
 * for that shared element.
 */
function NewTabHint() {
  return (
    <span id="ui-new-tab" hidden>
      Opens in a new tab
    </span>
  )
}

describe('TextLink', () => {
  it('renders a link, not a button', () => {
    render(<TextLink href="/journal/why-resin-moves">Why resin moves</TextLink>)
    const link = screen.getByRole('link', { name: 'Why resin moves' })
    expect(link).toHaveAttribute('href', '/journal/why-resin-moves')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is reachable by Tab and activates on Enter', async () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    render(
      <TextLink href="/collections/monsoon" onClick={onClick}>
        The Monsoon collection
      </TextLink>,
    )
    await userEvent.tab()
    expect(screen.getByRole('link')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('gives an external link the description the caller pointed it at', () => {
    render(
      <>
        <NewTabHint />
        <TextLink href="https://example.com/kiln-report" external externalHintId="ui-new-tab">
          The kiln report
        </TextLink>
      </>,
    )
    const link = screen.getByRole('link', { name: 'The kiln report' })
    expect(link).toHaveAccessibleDescription('Opens in a new tab')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('leaves an internal link undescribed and in the same tab', () => {
    render(<TextLink href="/contact">Speak to the studio</TextLink>)
    const link = screen.getByRole('link', { name: 'Speak to the studio' })
    expect(link).not.toHaveAttribute('target')
    expect(link).toHaveAccessibleDescription('')
  })

  it('keeps a description the caller already had alongside the new-tab hint', () => {
    render(
      <>
        <NewTabHint />
        <span id="pdf-size">PDF, 4 MB</span>
        <TextLink
          href="https://example.com/care-guide.pdf"
          external
          externalHintId="ui-new-tab"
          aria-describedby="pdf-size"
        >
          Care and maintenance guide
        </TextLink>
      </>,
    )
    expect(
      screen.getByRole('link', { name: 'Care and maintenance guide' }),
    ).toHaveAccessibleDescription('PDF, 4 MB Opens in a new tab')
  })

  it('lets the caller override the target it would otherwise choose', () => {
    render(
      <>
        <NewTabHint />
        <TextLink
          href="https://example.com/dispatch"
          external
          externalHintId="ui-new-tab"
          target="_self"
        >
          Dispatch tracking
        </TextLink>
      </>,
    )
    expect(screen.getByRole('link', { name: 'Dispatch tracking' })).toHaveAttribute(
      'target',
      '_self',
    )
  })

  it('does not let the trailing external glyph into the accessible name', () => {
    render(
      <>
        <NewTabHint />
        <TextLink href="https://example.com/press" external externalHintId="ui-new-tab">
          Press coverage
        </TextLink>
      </>,
    )
    // Exact match: a glyph reaching the name would make this query fail.
    expect(screen.getByRole('link', { name: 'Press coverage' })).toBeInTheDocument()
  })
})
