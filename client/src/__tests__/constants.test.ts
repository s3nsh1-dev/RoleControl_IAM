import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, queryKeys } from '../constants'

describe('queryKeys', () => {
  it('keeps auth and paginated key shapes stable', () => {
    expect(queryKeys.authMe).toEqual(['auth', 'me'])
    expect(queryKeys.users(1, 20)).toEqual(['users', { page: 1, pageSize: 20 }])
    expect(queryKeys.users()).toEqual([
      'users',
      { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    ])
    expect(queryKeys.userSessions(7, 2, 10)).toEqual([
      'user-sessions',
      7,
      { page: 2, pageSize: 10 },
    ])
  })
})
