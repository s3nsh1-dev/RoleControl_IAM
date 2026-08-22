# Playwright, real browser end-to-end tests

> **Scope**: How Playwright runs E2E tests against a real browser with a live Vite dev server, using route-level API mocking instead of MSW.
> **Core difference from Vitest/RTL/MSW**: Playwright tests run in a **real Chromium browser** against a **real Vite dev server**. There is no jsdom, no MSW, no in-process rendering.

---

## 1. What makes Playwright different

| Aspect | Vitest + RTL + MSW | Playwright |
|---|---|---|
| Environment | Node.js + jsdom (simulated DOM) | Real Chromium/Firefox/WebKit browser |
| Server | None, MSW fakes the network | Real Vite dev server on port 5174 |
| Component rendering | `render(<Component />)` in jsdom | Full app loads in browser via URL |
| API mocking | MSW patches `fetch`/`http` in Node | `page.route()` intercepts at the browser network layer |
| Speed | Fast, milliseconds per test | Slower, seconds for browser startup and navigation |
| What it tests | Component behavior in isolation | Full user flows end-to-end |
| File location | `src/**/*.test.{ts,tsx}` | `e2e/**/*.spec.ts` |

### Installed package

**File**: [`package.json`](../../package.json)

```json
"@playwright/test": "^1.60.0"
```

### CLI scripts

```json
"e2e": "playwright test",
"e2e:headed": "playwright test --headed"
```

| Script | What it does |
|---|---|
| `pnpm e2e` | Runs tests in **headless** mode (no visible browser) |
| `pnpm e2e:headed` | Runs tests in **headed** mode with the browser window visible, useful for debugging |

---

## 2. Config: `playwright.config.ts`

**File**: [`playwright.config.ts`](../../playwright.config.ts)

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --port 5174 --strictPort',
    port: 5174,
    reuseExistingServer: true,
  },
})
```

### Config breakdown

| Option | Value | Effect |
|---|---|---|
| `testDir` | `'./e2e'` | Playwright looks for `*.spec.ts` files here (NOT in `src/`) |
| `timeout` | `30_000` (30s) | Max time per test before it's marked as failed |
| `fullyParallel` | `true` | Tests across files run in parallel (each gets its own browser context) |
| `retries` | `1` | Failed tests are retried once before being marked as failed |
| `baseURL` | `http://localhost:5174` | `page.goto('/login')` resolves to `http://localhost:5174/login` |
| `trace` | `'on-first-retry'` | Captures a trace (timeline of actions, DOM snapshots, network) only on the first retry of a failed test |
| `screenshot` | `'only-on-failure'` | Auto-captures a screenshot when a test fails |

### `webServer`, auto-starting the dev server

```ts
webServer: {
  command: 'pnpm exec vite --port 5174 --strictPort',
  port: 5174,
  reuseExistingServer: true,
}
```

**What happens:**

1. Before running any tests, Playwright checks if port `5174` is already in use.
2. If **yes** (`reuseExistingServer: true`) → skip startup, use the existing server.
3. If **no** → run `pnpm exec vite --port 5174 --strictPort` to start a Vite dev server.
4. Playwright waits until port 5174 responds before running tests.
5. After all tests finish, Playwright kills the server process (if it started one).

> [!IMPORTANT]
> `--strictPort` means Vite will **error** if port 5174 is already taken (instead of auto-picking another port). This prevents Playwright from starting a server on the wrong port. Combined with `reuseExistingServer`, this means: either use an existing server on 5174, or start one specifically on 5174.

---

## 3. File structure

```
e2e/
  ├── helpers.ts       ← Shared route-mocking utilities
  ├── auth.spec.ts     ← Authentication flow tests
  └── rbac.spec.ts     ← Role-based access control tests
```

---

## 4. E2E helpers, route-level API mocking

**File**: [`e2e/helpers.ts`](../../e2e/helpers.ts)

Unlike Vitest tests (which use MSW to patch Node's HTTP), Playwright tests use `page.route()` to intercept requests **at the browser's network layer**.

### 4a. Response builders

```ts
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
```

> [!NOTE]
> These return **plain objects** (not `HttpResponse` instances like MSW). Playwright's `route.fulfill()` accepts raw JSON which it wraps into a proper HTTP response.

### 4b. Auth-me helper

```ts
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
```

Default user is a basic user with only `posts.view`. Tests can pass different capabilities to test RBAC behavior:

```ts
authMe(['posts.view', 'auditLogs.view'])  // User who can also see logs
authMe([])                                 // User with no capabilities
```

### 4c. Route fulfillment

```ts
export async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}
```

This is the bridge between Playwright's `page.route()` callback and the response builder helpers. It:
1. Takes the response body (plain object) from a helper like `ok()` or `apiError()`.
2. Stringifies it to JSON.
3. Fulfills the intercepted route with the proper status code and content type.

### 4d. Dashboard endpoint mocking

```ts
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
```

**Why this exists**: When the dashboard loads, the app fires multiple data-fetching queries. Without mocking, these would hit the real backend (which might not be running). This function stubs all dashboard endpoints with empty responses so the page loads cleanly.

> [!TIP]
> The `**` glob pattern in `**/api/users**` means "match any host/port and any query parameters". So `http://localhost:5174/api/users?page=1&pageSize=20` is matched.

---

## 5. Test spec: auth flow

**File**: [`e2e/auth.spec.ts`](../../e2e/auth.spec.ts)

### Test 1: successful login

```ts
test('user can log in and see the dashboard', async ({ page }) => {
  // 1. Mock all dashboard data endpoints
  await mockDashboardEndpoints(page)

  // 2. Mock the login endpoint
  await page.route('**/api/auth/login', (route) =>
    fulfillJson(route, ok({ user: { id: 1, fullname: 'E2E User', email: 'e2e@test.com' } }))
  )

  // 3. Mock the auth-me endpoint
  await page.route('**/api/auth/me', (route) => fulfillJson(route, authMe()))

  // 4. Navigate to login page
  await page.goto('/login')

  // 5. Fill in the form (like a real user would)
  await page.getByLabel('Email').fill('e2e@test.com')
  await page.getByLabel('Password').fill('password123')

  // 6. Click sign in
  await page.getByRole('button', { name: 'Sign in' }).click()

  // 7. Assert: redirected to dashboard
  await expect(page).toHaveURL(/\/dashboard/)

  // 8. Assert: user email is visible on dashboard
  await expect(page.getByText('e2e@test.com')).toBeVisible()
})
```

**Execution chain:**

```
page.goto('/login')
  │
  ▼
Browser loads http://localhost:5174/login
  │
  ▼
Vite serves the React app → React Router renders <LoginPage />
  │
  ▼
page.getByLabel('Email').fill('e2e@test.com')
  │  Playwright finds <input> associated with "Email" label
  │  Types 'e2e@test.com' character by character (real keyboard events)
  │
  ▼
page.getByRole('button', { name: 'Sign in' }).click()
  │  Playwright finds <button> with accessible name "Sign in"
  │  Fires real pointer + click events
  │
  ▼
React form submits → axios.post('/api/auth/login', { email, password })
  │
  ▼
page.route('**/api/auth/login') intercepts!
  │  Returns: { success: true, data: { user: { ... } } }
  │
  ▼
React receives success → calls useAuthStore.setAuthenticated()
  │  → navigates to /dashboard
  │
  ▼
Dashboard mounts → useQuery('auth-me') fires → axios.get('/api/auth/me')
  │
  ▼
page.route('**/api/auth/me') intercepts!
  │  Returns: { success: true, data: { user, roles, capabilities } }
  │
  ▼
Dashboard renders with user data
  │
  ▼
expect(page).toHaveURL(/\/dashboard/)  → ✅
expect(page.getByText('e2e@test.com')).toBeVisible()  → ✅
```

### Test 2: unauthenticated redirect

```ts
test('unauthenticated user is redirected to login', async ({ page }) => {
  // auth-me returns 401 → user is not logged in
  await page.route('**/api/auth/me', (route) =>
    fulfillJson(route, apiError(), 401)
  )
  // refresh also fails (or returns data but auth-me already failed)
  await page.route('**/api/auth/refresh', (route) =>
    fulfillJson(route, ok({ user: { ... } }))
  )

  await page.goto('/dashboard')

  // App's auth guard detects no auth → redirects to /login
  await expect(page).toHaveURL(/\/login/)
})
```

---

## 6. Test spec: RBAC flow

**File**: [`e2e/rbac.spec.ts`](../../e2e/rbac.spec.ts)

```ts
test('limited user does not see restricted navigation', async ({ page }) => {
  await mockDashboardEndpoints(page)

  // User with ONLY 'posts.view' capability
  await page.route('**/api/auth/me', (route) =>
    fulfillJson(route, authMe(['posts.view']))
  )

  await page.goto('/dashboard')

  // Can see their email and Posts link
  await expect(page.getByText('e2e@test.com')).toBeVisible()
  await expect(page.getByRole('link', { name: /Posts/i })).toBeVisible()

  // Cannot see restricted navigation items
  await expect(page.getByRole('link', { name: /Logs/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Migrations/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Sessions/i })).toHaveCount(0)
})
```

**What this tests**: The app's RBAC-driven navigation. Components conditionally render nav links based on the user's `capabilities` array. A user with only `posts.view` should NOT see admin-only links like Logs, Migrations, or Sessions.

---

## 7. Playwright route mocking against MSW

| Feature | MSW (`server.use`) | Playwright (`page.route`) |
|---|---|---|
| Where it runs | Node.js process (patches fetch/http) | Browser process (network layer) |
| Setup | Global in `setup.ts`, per-test via `server.use()` | Per-test via `page.route()` |
| Pattern matching | Exact paths: `/api/auth/me` | Glob patterns: `**/api/auth/me` |
| Response creation | `HttpResponse.json({...})` | `route.fulfill({ body: JSON.stringify({...}) })` |
| Cleanup | `server.resetHandlers()` in afterEach | Automatic, routes die with the page or context |
| Works with | jsdom (simulated browser) | Real browser (Chromium/Firefox/WebKit) |

---

## 8. Full execution chain

```
pnpm e2e
  │
  ▼
playwright CLI boots
  │
  ▼
Reads playwright.config.ts
  ├─ testDir: './e2e'
  ├─ webServer.command: 'pnpm exec vite --port 5174 --strictPort'
  └─ use.baseURL: 'http://localhost:5174'
  │
  ▼
Checks port 5174
  ├─ In use? → reuseExistingServer: true → skip
  └─ Not in use? → Start: pnpm exec vite --port 5174 --strictPort
     Wait until port 5174 responds...
  │
  ▼
Discovers test files in e2e/
  ├─ auth.spec.ts
  └─ rbac.spec.ts
  │
  ▼
For each test (fullyParallel: true):
  │
  ├─ Launch Chromium (headless by default)
  ├─ Create isolated BrowserContext (clean cookies, storage)
  ├─ Create Page
  │
  ├─ Test registers page.route() interceptors
  │    ├─ **/api/auth/me → mock auth response
  │    ├─ **/api/auth/login → mock login success
  │    ├─ **/api/users** → empty list
  │    └─ ... other endpoints ...
  │
  ├─ page.goto('/login')
  │    ├─ Browser navigates to http://localhost:5174/login
  │    ├─ Vite serves index.html + JS bundle
  │    ├─ React app boots in real browser
  │    └─ Any API calls hit page.route() interceptors
  │
  ├─ page.getByLabel('Email').fill('e2e@test.com')
  │    └─ Real keyboard events in real browser
  │
  ├─ page.getByRole('button', { name: 'Sign in' }).click()
  │    └─ Real pointer/click events
  │
  ├─ expect(page).toHaveURL(/\/dashboard/)
  │    └─ Polls URL until it matches (auto-waits up to 5s default)
  │
  ├─ expect(page.getByText('e2e@test.com')).toBeVisible()
  │    └─ Polls DOM until element is visible (auto-waits)
  │
  ├─ Test passes or fails
  │    ├─ On fail → screenshot captured (screenshot: 'only-on-failure')
  │    └─ On retry → trace captured (trace: 'on-first-retry')
  │
  └─ BrowserContext + Page destroyed (clean isolation)
  │
  ▼
All tests complete
  │
  ▼
Kill Vite dev server (if Playwright started it)
  │
  ▼
Report results to terminal
Artifacts saved to test-results/
```

---

## 9. File dependency map

```
package.json  ──"e2e": "playwright test"──▶  playwright CLI
                                                  │
                                                  ▼
                                          playwright.config.ts
                                           │            │
                                           ▼            ▼
                                     webServer:     testDir:
                                     Vite on 5174   './e2e'
                                                      │
                                         ┌────────────┼────────────┐
                                         ▼            ▼            ▼
                                    helpers.ts   auth.spec.ts  rbac.spec.ts
                                         │            │            │
                                         │            ▼            ▼
                                         │       Uses helpers:
                                         │       - ok(), apiError(), authMe()
                                         │       - fulfillJson()
                                         │       - mockDashboardEndpoints()
                                         │
                                         ▼
                                    Response builders:
                                    ok(), emptyOk(), apiError(), authMe()
                                         │
                                         ▼
                                    fulfillJson(route, body, status)
                                         │
                                         ▼
                                    route.fulfill({ status, body, contentType })
                                         │
                                         ▼
                                    Browser receives mocked HTTP response
```

---

## 10. Debugging Playwright tests

| Need | Command / Config |
|---|---|
| See the browser | `pnpm e2e:headed` |
| Step through a test | `pnpm exec playwright test --debug` |
| View trace of a failed test | `pnpm exec playwright show-trace test-results/<test>/trace.zip` |
| Generate tests by recording | `pnpm exec playwright codegen http://localhost:5174` |
| Run a single test file | `pnpm exec playwright test e2e/auth.spec.ts` |
| Run a single test by name | `pnpm exec playwright test -g "user can log in"` |

---

## 11. Where this shows up

**The jsdom suite is green and login is broken.** Cookies, redirects and
navigation are browser behaviour. jsdom approximates them; Chromium does not have
to. This is the class of bug Playwright exists to catch.

**A spec passes locally and fails in CI.** Almost always a timing assumption.
`await expect(locator).toBeVisible()` retries until the timeout, a bare
`expect(await locator.isVisible())` samples once and races the app.

**Port 5174 is already in use.** The config starts its own dev server with
`--strictPort`, so a stray `pnpm dev` on that port stops the run instead of
silently testing the wrong build.

**A route mock does nothing.** `page.route` must be registered before the
navigation that triggers the request. Registered after `page.goto`, the real
request has already left.

---

Previous: [MSW](./MSW.doc.md).
Next: [client/docs index](../docs.index.md), back to the full topic list.
