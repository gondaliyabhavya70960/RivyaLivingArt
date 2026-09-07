import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorText } from './index'

describe('ErrorText', () => {
  it('announces itself the moment it appears', () => {
    render(<ErrorText>Enter an email address we can reply to</ErrorText>)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an email address we can reply to')
  })

  it('keeps its icon out of the description it gives the control', () => {
    render(
      <>
        <input aria-label="Email address" aria-describedby="email-error" aria-invalid />
        <ErrorText id="email-error">Enter an email address we can reply to</ErrorText>
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAccessibleDescription(
      'Enter an email address we can reply to',
    )
  })
})
