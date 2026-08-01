import { describe, expect, it } from 'vitest'
import { ApiClientError, getErrorMessage } from '../client'

describe('getErrorMessage', () => {
  it('returns Error messages and a fallback for non-Error values', () => {
    expect(getErrorMessage(new Error('Broken'))).toBe('Broken')
    expect(getErrorMessage('Broken')).toBe('Something went wrong')
    expect(getErrorMessage(null)).toBe('Something went wrong')
  })
})

describe('ApiClientError', () => {
  it('stores status code, details, retry-after, and message', () => {
    const error = new ApiClientError(
      'Invalid input',
      422,
      {
        success: false,
        status: 'fail',
        message: 'Invalid input',
        details: [{ code: 'invalid_format', path: ['email'], message: 'Email is invalid' }],
      },
      '30',
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiClientError')
    expect(error.message).toBe('Invalid input')
    expect(error.statusCode).toBe(422)
    expect(error.details).toEqual([
      { code: 'invalid_format', path: ['email'], message: 'Email is invalid' },
    ])
    expect(error.retryAfter).toBe('30')
  })
})
