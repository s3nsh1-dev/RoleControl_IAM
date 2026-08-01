import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthPage } from '../AuthPage'
import { createMockAuthMe } from '@/test/fixtures'
import { ok, apiError } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { render, screen, userEvent } from '@/test/test-utils'

function renderAuth(initialPath = '/login') {
  return render(
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/dashboard" element={<h1>Dashboard reached</h1>} />
    </Routes>,
    { routerProps: { initialEntries: [initialPath] } },
  )
}

describe('AuthPage', () => {
  it('renders login by default and can switch to register mode', async () => {
    const user = userEvent.setup()
    renderAuth()

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bootstrap' }))

    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create first super-admin' }),
    ).toBeInTheDocument()
  })

  it('renders register mode from the register route', () => {
    renderAuth('/register')

    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
  })

  it('shows validation errors for invalid login input', async () => {
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByLabelText('Password'))
    await user.type(screen.getByLabelText('Password'), 'abc')
    await user.tab()

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(await screen.findByText('Password must be at least 4 characters')).toBeInTheDocument()
  })

  it('logs in, fetches access data, and navigates to the dashboard', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/auth/login', () =>
        ok({ user: { id: 1, fullname: 'Admin', email: 'admin@test.com' } }),
      ),
      http.get('/api/auth/me', () => ok(createMockAuthMe())),
    )
    renderAuth()

    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard reached' })).toBeInTheDocument()
    expect(await screen.findByText('Signed in')).toBeInTheDocument()
  })

  it('shows an error toast on failed login', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/auth/login', () => apiError(401, 'Invalid credentials')),
    )
    renderAuth()

    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  it('registers a bootstrap account and returns to login mode', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({
          success: true,
          message: 'Created',
          data: {
            user: {
              id: 1,
              fullname: 'Admin User',
              email: 'admin@test.com',
              is_active: true,
              created_at: '2026-01-01T00:00:00.000Z',
              created_by: null,
            },
            roles: ['super-admin'],
          },
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      ),
    )
    renderAuth('/register')

    await user.type(screen.getByLabelText('Full name'), 'Admin User')
    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create first super-admin' }))

    expect(
      await screen.findByText('Bootstrap account created. Sign in to continue.'),
    ).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
