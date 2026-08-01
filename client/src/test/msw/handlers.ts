import { http, HttpResponse } from 'msw'
import { createMockAuthMe } from '../fixtures'
import type { AuthMeData } from '@/api/types'

export const ok = <T,>(data: T, message = 'OK') =>
  HttpResponse.json({
    success: true,
    message,
    data,
    timestamp: '2026-01-01T00:00:00.000Z',
  })

export const emptyOk = (message = 'OK') =>
  HttpResponse.json({
    success: true,
    message,
    timestamp: '2026-01-01T00:00:00.000Z',
  })

export const apiError = (status: number, message = 'Request failed') =>
  HttpResponse.json(
    {
      success: false,
      status: status >= 500 ? 'error' : 'fail',
      message,
    },
    { status },
  )

export const mockAuthMeData: AuthMeData = createMockAuthMe()

export const handlers = [
  http.get('/api/auth/me', () => ok(mockAuthMeData)),
  http.get('/api/auth/refresh', () =>
    ok({ user: mockAuthMeData.user }, 'Session refreshed'),
  ),
  http.post('/api/auth/logout', () => emptyOk('Logged out')),
]
