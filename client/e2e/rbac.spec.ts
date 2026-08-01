import { expect, test } from '@playwright/test'
import { authMe, fulfillJson, mockDashboardEndpoints } from './helpers'

test('limited user does not see restricted navigation', async ({ page }) => {
  await mockDashboardEndpoints(page)
  await page.route('**/api/auth/me', (route) =>
    fulfillJson(route, authMe(['posts.view'])),
  )

  await page.goto('/dashboard')

  await expect(page.getByText('e2e@test.com')).toBeVisible()
  await expect(page.getByRole('link', { name: /Posts/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Logs/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Migrations/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Sessions/i })).toHaveCount(0)
})
