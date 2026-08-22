# MSW, faking the network in unit tests

> **Scope**: How MSW intercepts HTTP requests during Vitest unit/integration tests, providing fake API responses without a running backend.
> **Core principle**: Intercept at the **network level**, not by mocking `axios`/`fetch`. Your application code runs unmodified. It has no idea the server is fake.

---

## 1. What MSW does in this project

| Without MSW | With MSW |
|---|---|
| Component calls `axios.get('/api/auth/me')` | Same, component code is identical |
| Request hits the real backend (or fails) | MSW **intercepts** the request before it leaves the process |
| Test depends on backend state | MSW handler returns a **deterministic fake response** |
| Tests are flaky, slow, coupled | Tests are fast, isolated, predictable |

MSW works in **two modes**:
- Browser mode, `setupWorker`, uses a real Service Worker for dev/storybook. Not used here.
- Node mode, `setupServer`, patches Node's `http`/`https` modules to intercept requests. **This is what Vitest tests use.**

### Installed package

**File**: [`package.json`](../../package.json)

```json
"msw": "^2.14.6"
```

---

## 2. File structure

```
src/test/msw/
  ├── handlers.ts    ← Default request handlers (the "happy path" API)
  └── server.ts      ← Creates the MSW server instance
```

---

## 3. Handlers, the fake API

**File**: [`src/test/msw/handlers.ts`](../../src/test/msw/handlers.ts)

### 3a. Response helpers

```ts
import { http, HttpResponse } from 'msw'
import { createMockAuthMe } from '../fixtures'
import type { AuthMeData } from '@/api/types'
```

Three helper functions create responses matching the real API's envelope format:

```ts
// Success with data
export const ok = <T,>(data: T, message = 'OK') =>
  HttpResponse.json({
    success: true,
    message,
    data,
    timestamp: '2026-01-01T00:00:00.000Z',
  })

// Success without data (e.g., logout)
export const emptyOk = (message = 'OK') =>
  HttpResponse.json({
    success: true,
    message,
    timestamp: '2026-01-01T00:00:00.000Z',
  })

// Error response
export const apiError = (status: number, message = 'Request failed') =>
  HttpResponse.json(
    {
      success: false,
      status: status >= 500 ? 'error' : 'fail',
      message,
    },
    { status },
  )
```

> [!IMPORTANT]
> These helpers mirror the **exact response shape** of the real backend API (`{ success, message, data, timestamp }`). If the real API envelope changes, these must change too, or tests will silently test against a wrong contract.

### 3b. Default mock data

```ts
export const mockAuthMeData: AuthMeData = createMockAuthMe()
```

This calls the fixture factory in [`fixtures.ts`](../../src/test/fixtures.ts), producing a full `AuthMeData` object with a super-admin user and all capabilities.

### 3c. Default handler array

```ts
export const handlers = [
  http.get('/api/auth/me', () => ok(mockAuthMeData)),
  http.get('/api/auth/refresh', () =>
    ok({ user: mockAuthMeData.user }, 'Session refreshed'),
  ),
  http.post('/api/auth/logout', () => emptyOk('Logged out')),
]
```

**How each handler works:**

| Handler | Intercepts | Returns |
|---|---|---|
| `http.get('/api/auth/me', ...)` | `GET /api/auth/me` | Full auth-me response (user + roles + capabilities) |
| `http.get('/api/auth/refresh', ...)` | `GET /api/auth/refresh` | Refresh response with just the user object |
| `http.post('/api/auth/logout', ...)` | `POST /api/auth/logout` | Empty success (no data payload) |

> [!NOTE]
> Only auth endpoints have default handlers. This is intentional. Most tests will `server.use(...)` to add handlers specific to what they're testing. The auth defaults exist because almost every component-level test needs the auth-me query to succeed (the app checks auth on mount).

### The `http.get()` and `http.post()` API

```ts
http.get('/api/auth/me', (info) => {
  // info.request  → the intercepted Request object
  // info.params   → URL path params
  // info.cookies  → parsed cookies
  return ok(mockAuthMeData)  // ← must return a Response
})
```

MSW matches on path alone, so `/api/auth/me` matches any request to that path regardless of host/port (because in jsdom, requests go to the same origin).

---

## 4. Server, the interceptor

**File**: [`src/test/msw/server.ts`](../../src/test/msw/server.ts)

```ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

`setupServer(...)` creates an MSW server instance pre-loaded with the default handlers.

> [!IMPORTANT]
> `setupServer` is imported from `msw/node` (NOT `msw`). The `/node` entry point patches Node's HTTP modules. The base `msw` entry provides the browser Service Worker variant.

At this point the server is **created but NOT listening**. It doesn't intercept anything until `.listen()` is called.

---

## 5. Lifecycle: how `setup.ts` wires it

**File**: [`src/test/setup.ts`](../../src/test/setup.ts)

```ts
import { server } from './msw/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

afterEach(() => {
  server.resetHandlers()
  // ... other cleanup ...
})

afterAll(() => server.close())
```

### The lifecycle in detail

```
Worker boots
     │
     ▼
beforeAll() ──▶ server.listen({ onUnhandledRequest: 'warn' })
     │           │
     │           ├─ Patches globalThis.fetch
     │           ├─ Patches http.request / https.request
     │           └─ Installs the 3 default handlers from handlers.ts
     │
     ▼
Test 1 runs
     │  Component calls axios.get('/api/auth/me')
     │       │
     │       ▼
     │  axios → fetch (or http.request) → MSW interceptor
     │       │
     │       ▼
     │  MSW matches: http.get('/api/auth/me', ...) → handler found!
     │       │
     │       ▼
     │  Handler returns: ok(mockAuthMeData)
     │       │
     │       ▼
     │  MSW constructs a real Response object
     │       │
     │       ▼
     │  axios receives it as if a real server responded
     │       │
     │       ▼
     │  Component processes the response normally
     │
     ▼
afterEach() ──▶ server.resetHandlers()
     │           │
     │           └─ Removes any handlers added via server.use(...)
     │              Restores back to the 3 defaults
     │
     ▼
Test 2 runs ...
     │
     ▼
afterAll() ──▶ server.close()
                 │
                 ├─ Unpatches fetch
                 ├─ Unpatches http/https
                 └─ Server is fully torn down
```

### `onUnhandledRequest: 'warn'`

If a test makes an HTTP request that **no handler** matches:
- MSW prints a **warning** to the console (not an error).
- The request is **not intercepted**. It either fails or tries to reach a real server.

This catches missing handlers early without crashing the test suite.

---

## 6. Per-test handler overrides

Tests can temporarily add or override handlers for specific scenarios:

```ts
// Example: test an error response
it('shows error toast on 401', async () => {
  server.use(
    http.get('/api/auth/me', () => apiError(401, 'Unauthorized'))
  )
  // ... render component, assert error UI ...
})
```

**How `server.use()` works:**

1. The new handler is pushed to the **front** of the handler list.
2. MSW matches handlers first-in-first-out, so the override takes priority.
3. `afterEach → server.resetHandlers()` removes the override.
4. The next test sees the original defaults again.

```
Default handlers:   [GET /api/auth/me → ok(data)]
                              │
After server.use(): [GET /api/auth/me → apiError(401)]  ← checked first
                    [GET /api/auth/me → ok(data)]        ← never reached
                              │
After resetHandlers(): [GET /api/auth/me → ok(data)]    ← back to normal
```

---

## 7. Fixtures, the mock data factory

**File**: [`src/test/fixtures.ts`](../../src/test/fixtures.ts)

Fixtures provide **factory functions** that generate typed mock data matching the real API types.

### Auto-incrementing ids

```ts
let nextId = 1

export function resetMockIds() {
  nextId = 1
}
```

Every factory function calls `nextId++`, producing unique IDs. `resetMockIds()` is called in `afterEach` to ensure ID sequences are deterministic per test.

### Factory functions

| Factory | Returns | Default shape |
|---|---|---|
| `createMockUser()` | `AuthenticatedUser` | `{ id: N, fullname: 'User N', email: 'userN@test.com' }` |
| `createMockAuthMe()` | `AuthMeData` | Super-admin user with all 23 capabilities |
| `createMockUserListItem()` | `UserListItem` | Active user with `['user']` role |
| `createMockRole()` | `Role` | `{ name: 'user', description: 'Default user role' }` |
| `createMockPermission()` | `Permission` | `{ action: 'view', resource: 'post' }` |
| `createMockRolePermissionAssignment()` | `RolePermissionAssignment` | Role + permission composite |
| `createMockPost()` | `Post` | `{ title: 'Test Post N', content: 'Test content' }` |
| `capabilities(...)` | `CapabilityKey[]` | Type-safe capability array builder |

Every factory accepts a `Partial<T>` override to customize specific fields:

```ts
createMockUser({ email: 'custom@test.com' })
// → { id: 1, fullname: 'User 1', email: 'custom@test.com' }
```

---

## 8. Full request interception chain

```
Component code                    MSW layer                    Test assertion
─────────────                    ─────────                    ──────────────

useQuery('auth-me',         ┌──▶ MSW intercepts fetch()
  () => axios.get(          │    │
    '/api/auth/me'          │    ▼
  )                         │    Match against handler list:
)                           │    http.get('/api/auth/me') ✓
   │                        │    │
   │  axios calls fetch()───┘    ▼
   │                             Handler executes:
   │                             ok(mockAuthMeData)
   │                             │
   │                             ▼
   │                             HttpResponse.json({
   │                               success: true,
   │                               data: { user, roles, capabilities },
   │                               ...
   │                             })
   │                             │
   │  ◀─────── Response ─────────┘
   │
   ▼
useQuery resolves
   │
   ▼
Component re-renders
with auth data
   │                                              expect(
   └──────── DOM updated ───────────────────────▶   screen.getByText('admin@test.com')
                                                  ).toBeVisible()
```

---

## 9. File dependency map

```
src/test/setup.ts
      │
      ├── imports ──▶ src/test/msw/server.ts
      │                     │
      │                     └── imports ──▶ src/test/msw/handlers.ts
      │                                          │
      │                                          ├── imports ──▶ msw (http, HttpResponse)
      │                                          └── imports ──▶ src/test/fixtures.ts
      │                                                               │
      │                                                               └── imports ──▶ src/api/types.ts
      │
      ├── beforeAll → server.listen()     ← Start intercepting
      ├── afterEach → server.resetHandlers() ← Clean overrides
      ├── afterEach → resetMockIds()      ← Reset fixture counters
      └── afterAll  → server.close()      ← Stop intercepting
```

---

## 10. Where this shows up

**A test hangs, then fails with a timeout.** The component called an endpoint
with no handler. MSW warned in the console rather than failing loudly, because
`onUnhandledRequest` is `'warn'`. Read the warning, add the handler.

**Every test passes, and the feature is broken in production.** The handlers in
`handlers.ts` returned the old envelope shape after the real API changed. MSW
tests whatever contract you write down, so the fixtures are only as honest as you
keep them.

**An error state has no test.** Error paths need `server.use(...)` with
`apiError(401)` for that one test. Without an override, the default handler
always succeeds, and the error branch is never executed.

**IDs drift between tests.** The fixture counter increments across a file.
`resetMockIds()` in `afterEach` puts it back to 1, which is what lets a test
assert on `id: 1` at all.

---

Previous: [React Testing Library](./React_Testing_library.doc.md).
Next: [Playwright](./Playwright.doc.md), the same flows in a real browser instead of jsdom.
