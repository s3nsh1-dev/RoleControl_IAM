import { http, delay } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProtectedRoute } from '../ProtectedRoute'
import { createMockAuthMe } from '@/test/fixtures'
import { apiError, ok } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { render, screen } from '@/test/test-utils'

function renderProtectedRoute() {
  return render(
    <Routes>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <h1>Protected content</h1>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<h1>Login page</h1>} />
    </Routes>,
    { routerProps: { initialEntries: ['/dashboard'] } },
  )
}

describe('ProtectedRoute', () => {
  it('shows loading UI while auth is pending', async () => {
    server.use(
      http.get('/api/auth/me', async () => {
        await delay('infinite')
        return ok(createMockAuthMe())
      }),
    )

    renderProtectedRoute()

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('renders children when authenticated', async () => {
    server.use(http.get('/api/auth/me', () => ok(createMockAuthMe())))

    renderProtectedRoute()

    expect(
      await screen.findByRole('heading', { name: 'Protected content' }),
    ).toBeInTheDocument()
  })

  it('redirects to login when auth remains unauthorized after refresh', async () => {
    server.use(
      http.get('/api/auth/me', () => apiError(401, 'Unauthorized')),
      http.get('/api/auth/refresh', () =>
        ok({ user: { id: 1, fullname: 'Admin', email: 'admin@test.com' } }),
      ),
    )

    renderProtectedRoute()

    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument()
  })

  it('shows an API error state for non-401 failures', async () => {
    server.use(http.get('/api/auth/me', () => apiError(500, 'Server unavailable')))

    renderProtectedRoute()

    expect(await screen.findByText('API unavailable')).toBeInTheDocument()
    expect(screen.getByText('Server unavailable')).toBeInTheDocument()
  })
})
