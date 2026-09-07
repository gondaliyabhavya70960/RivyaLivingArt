import type { FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IconButton } from './index'

/** A stand-in for a real icon: 20px, currentColor, stroke-width 1.5 (§7.2). */
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <title>a decorative title the icon should not contribute</title>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

describe('IconButton', () => {
  it('takes its accessible name from aria-label, not from the glyph', () => {
    render(
      <IconButton aria-label="Close the enquiry drawer">
        <CloseIcon />
      </IconButton>,
    )
    // Exact match: an icon that leaked into the name would append its <title> here.
    expect(screen.getByRole('button', { name: 'Close the enquiry drawer' })).toBeInTheDocument()
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <IconButton aria-label="Remove Walnut Console 01.jpg" disabled onClick={onClick}>
        <CloseIcon />
      </IconButton>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is reachable by Tab and activates on both Enter and Space', async () => {
    const onClick = vi.fn()
    render(
      <IconButton aria-label="Next image" onClick={onClick}>
        <CloseIcon />
      </IconButton>,
    )
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Next image' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('does not submit the form it sits in unless asked to', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <IconButton aria-label="Clear the search field">
          <CloseIcon />
        </IconButton>
      </form>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits when the caller asks for a submit button', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <IconButton aria-label="Search" type="submit">
          <CloseIcon />
        </IconButton>
      </form>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('passes aria state through to the button so it can be a toggle', () => {
    render(
      <IconButton aria-label="Pin this row" aria-pressed>
        <CloseIcon />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Pin this row', pressed: true })).toBeInTheDocument()
  })
})
