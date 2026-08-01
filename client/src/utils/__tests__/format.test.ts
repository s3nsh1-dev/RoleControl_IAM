import { describe, expect, it } from 'vitest'
import { cx, formatDate } from '../format'

describe('formatDate', () => {
  it('returns "Not set" for nullish and empty values', () => {
    expect(formatDate(null)).toBe('Not set')
    expect(formatDate(undefined)).toBe('Not set')
    expect(formatDate('')).toBe('Not set')
  })

  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-01-15T10:30:00.000Z')

    expect(result).not.toBe('Not set')
    expect(result).toContain('2026')
  })
})

describe('cx', () => {
  it('joins truthy class names and filters falsy values', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c')
    expect(cx('a', false, null, undefined, 'b')).toBe('a b')
    expect(cx(false, null, undefined)).toBe('')
  })
})
