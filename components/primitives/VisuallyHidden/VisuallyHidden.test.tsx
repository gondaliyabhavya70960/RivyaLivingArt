import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VisuallyHidden } from './index'

describe('VisuallyHidden', () => {
  it('can name a control it is wired to, so the name survives being hidden', () => {
    render(
      <>
        <VisuallyHidden id="search-label">Search the catalogue</VisuallyHidden>
        <input type="search" aria-labelledby="search-label" />
      </>,
    )
    expect(screen.getByRole('searchbox', { name: 'Search the catalogue' })).toBeInTheDocument()
  })

  it('names a table as a real caption element', () => {
    render(
      <table>
        <VisuallyHidden as="caption">Products, sorted by title</VisuallyHidden>
        <tbody>
          <tr>
            <td>Atlas dining table</td>
          </tr>
        </tbody>
      </table>,
    )
    expect(screen.getByRole('table', { name: 'Products, sorted by title' })).toBeInTheDocument()
  })

  it('hides content from the eye, never from the keyboard', async () => {
    render(
      <VisuallyHidden focusable>
        <a href="#main">Skip to content</a>
      </VisuallyHidden>,
    )
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus()
  })

  it('spreads consumer attributes onto the element', () => {
    render(
      <>
        <VisuallyHidden id="unit-hint" data-role="technical">
          measured in centimetres
        </VisuallyHidden>
        <input aria-label="Length" aria-describedby="unit-hint" />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Length' })).toHaveAccessibleDescription(
      'measured in centimetres',
    )
  })
})
