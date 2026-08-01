import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw/server'
import { resetMockIds } from './fixtures'
import { useAuthStore } from '@/store/auth'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetMockIds()
  localStorage.clear()
  document.documentElement.className = ''
  document.body.className = ''
  useAuthStore.persist.clearStorage()
  useAuthStore.setState({ isAuthenticated: false })
})

afterAll(() => server.close())
