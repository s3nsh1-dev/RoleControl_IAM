import { expect, test } from '@playwright/test'
import {
  apiError,
  authMe,
  fulfillJson,
  mockDashboardEndpoints,
  ok,
} from './helpers'

test('user can log in and see the dashboard', async ({ page }) => {
  await mockDashboardEndpoints(page)
  await page.route('**/api/auth/login', (route) =>
    fulfillJson(
      route,
      ok({ user: { id: 1, fullname: 'E2E User', email: 'e2e@test.com' } }),
    ),
  )
  await page.route('**/api/auth/me', (route) => fulfillJson(route, authMe()))

  await page.goto('/login')
  await page.getByLabel('Email').fill('e2e@test.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('e2e@test.com')).toBeVisible()
})

test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    fulfillJson(route, apiError(), 401),
  )
  await page.route('**/api/auth/refresh', (route) =>
    fulfillJson(
      route,
      ok({ user: { id: 1, fullname: 'E2E User', email: 'e2e@test.com' } }),
    ),
  )

  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login/)
})
