import type { Page, Route } from '@playwright/test'

export const ok = <T>(data: T, message = 'OK') => ({
  success: true,
  message,
  data,
  timestamp: '2026-01-01T00:00:00.000Z',
})

export const emptyOk = (message = 'OK') => ({
  success: true,
  message,
  timestamp: '2026-01-01T00:00:00.000Z',
})

export const apiError = (message = 'Unauthorized') => ({
  success: false,
  status: 'fail',
  message,
})

export const authMe = (capabilities: string[] = ['posts.view']) =>
  ok({
    user: {
      id: 1,
      fullname: 'E2E User',
      email: 'e2e@test.com',
    },
    roles: ['user'],
    capabilities,
  })

export async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function mockDashboardEndpoints(page: Page) {
  const emptyPagination = { page: 1, pageSize: 20, total: 0, totalPages: 0 }

  await page.route('**/api/users**', (route) =>
    fulfillJson(route, ok({ users: [], pagination: emptyPagination })),
  )
  await page.route('**/api/roles**', (route) =>
    fulfillJson(route, ok({ roles: [], pagination: emptyPagination })),
  )
  await page.route('**/api/permissions**', (route) =>
    fulfillJson(route, ok({ permissions: [], pagination: emptyPagination })),
  )
  await page.route('**/api/posts**', (route) =>
    fulfillJson(route, ok({ posts: [], pagination: emptyPagination })),
  )
}
