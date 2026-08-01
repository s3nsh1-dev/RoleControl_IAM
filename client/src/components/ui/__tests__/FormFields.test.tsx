import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { Field } from '../FormFields'

describe('Field', () => {
  it('renders an accessible input with its label', () => {
    render(<Field label="Email" name="email" />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows errors and marks the input invalid when error is set', () => {
    render(<Field label="Email" name="email" error="Enter a valid email address" />)

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /email/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('does not render an error element in the clean state', () => {
    render(<Field label="Email" name="email" />)

    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
  })
})
