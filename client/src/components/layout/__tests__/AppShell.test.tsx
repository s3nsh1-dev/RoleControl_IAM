import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AppShell } from '../AppShell'
import { useAuthStore } from '@/store/auth'
import {
  capabilities,
  createMockAuthMe,
  createPaginationMeta,
} from '@/test/fixtures'
import { emptyOk, ok } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { render, screen, userEvent, waitFor } from '@/test/test-utils'

function mockDashboardEndpoints() {
  server.use(
    http.get('/api/users', () =>
      ok({ users: [], pagination: createPaginationMeta(0) }),
    ),
    http.get('/api/roles', () =>
      ok({ roles: [], pagination: createPaginationMeta(0) }),
    ),
    http.get('/api/permissions', () =>
      ok({ permissions: [], pagination: createPaginationMeta(0) }),
    ),
    http.get('/api/posts', () =>
      ok({ posts: [], pagination: createPaginationMeta(0) }),
    ),
  )
}

describe('AppShell', () => {
  it('renders navigation and session info from access data', async () => {
    mockDashboardEndpoints()
    server.use(
      http.get('/api/auth/me', () =>
        ok(
          createMockAuthMe({
            user: { id: 1, fullname: 'Limited User', email: 'limited@test.com' },
            roles: ['user'],
            capabilities: capabilities('posts.view'),
          }),
        ),
      ),
    )

    render(<AppShell />, { routerProps: { initialEntries: ['/dashboard'] } })

    expect(await screen.findByText('limited@test.com')).toBeInTheDocument()
    expect(screen.getByText('user')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Posts/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Logs/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Migrations/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sessions/i })).not.toBeInTheDocument()
  })

  it('shows the sessions nav group when a session child capability is present', async () => {
    mockDashboardEndpoints()
    server.use(
      http.get('/api/auth/me', () =>
        ok(
          createMockAuthMe({
            capabilities: capabilities('sessions.revoke'),
          }),
        ),
      ),
    )

    render(<AppShell />, { routerProps: { initialEntries: ['/dashboard'] } })

    expect(await screen.findByRole('button', { name: /Sessions/i })).toBeInTheDocument()
  })

  it('logs out through the API and clears local auth state', async () => {
    const user = userEvent.setup()
    mockDashboardEndpoints()
    useAuthStore.getState().setAuthenticated()
    server.use(
      http.get('/api/auth/me', () => ok(createMockAuthMe())),
      http.post('/api/auth/logout', () => emptyOk('Logged out')),
    )

    render(<AppShell />, { routerProps: { initialEntries: ['/dashboard'] } })

    await user.click(await screen.findByRole('button', { name: /Logout/i }))

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
  })
})
