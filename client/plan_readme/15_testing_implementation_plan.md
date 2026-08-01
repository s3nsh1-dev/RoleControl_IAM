# Testing Implementation Plan — RoleControl IAM Client

> A beginner-friendly, production-minded testing plan for this React app.

---

## Overview

This plan uses production tools, but it does **not** try to test every file immediately.

The goal is to build confidence around the riskiest frontend behavior first:

- auth and route protection
- RBAC-gated navigation and actions
- validation schemas
- API loading, success, empty, and error states
- one representative CRUD workflow

Chosen approach:

> Use a trimmed production-minded first pass now. Grow toward broader production coverage after these patterns are stable.

Interview explanation:

> I chose a risk-based testing plan. I used Vitest, React Testing Library, MSW, and Playwright because those are production-grade tools, but I started with auth, RBAC, validation, API states, and one CRUD flow instead of testing every page immediately. That keeps the suite useful, understandable, and maintainable for a small app.

### Selected Phases

1. **Phase 1 — Foundation**: Install tools, configure Vitest, create test utilities
2. **Phase 2 — Unit Tests**: Cover pure logic and schemas that affect business behavior
3. **Phase 3 — Focused Integration Tests**: Test auth, protected routing, RBAC, and Posts with MSW
4. **Phase 4 — Minimal E2E Tests**: Add only the most important browser journeys

---

## Current State Audit

### What We Have

| Tool | What it catches |
|---|---|
| TypeScript (`tsc -b`) | Type errors, missing properties, wrong argument types |
| ESLint + react-hooks plugin | Hook rule violations and code quality issues |
| Zod schemas | Runtime validation rules, though not yet tested |
| Generated OpenAPI types | Frontend/backend contract types in `src/api/schema.ts` |

### What We're Missing

- No test runner configured
- No test files in `src`
- No API mocking layer
- No E2E framework
- No CI integration for tests
- No coverage reporting

### Important Codebase Facts

- `pnpm typecheck` currently passes.
- The app uses Vite, React 19, React Router 7, TanStack Query 5, Zustand, Zod, Axios, and Sonner.
- The source alias `@/*` is already configured in `vite.config.ts` and `tsconfig.app.json`.
- The API client unwraps success envelopes, so mocks must return backend-style envelopes:

```typescript
{
  success: true,
  message: 'OK',
  data: { /* endpoint payload */ },
  timestamp: '2026-01-01T00:00:00.000Z',
}
```

- `ProtectedRoute` can trigger `/api/auth/refresh` after a 401 from `/api/auth/me`; tests for unauthorized redirects must handle that intentionally.
- `AppShell` lives at `src/components/layout/AppShell.tsx`, not directly under `src/components`.
- `Post` has no `updated_at` field, and `PaginationMeta` uses `total`, not `totalCount`.

---

## Phase 1 — Foundation Setup

### 1.1 Install Dependencies

```bash
pnpm add -D vitest @vitest/coverage-v8
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm add -D msw jsdom
```

Only install Vitest UI if you decide to keep a UI script:

```bash
pnpm add -D @vitest/ui
```

For Playwright in Phase 4:

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

### 1.2 Configure Vitest

Update `vite.config.ts`:

```typescript
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/api/schema.ts',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
    },
  },
})
```

Why `vitest/config` instead of `vite`:

> The current config has no `test` block. Importing `defineConfig` from `vitest/config` gives TypeScript the correct config type for Vitest options.

### 1.3 Add Scripts

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage",
  "e2e": "playwright test",
  "e2e:headed": "playwright test --headed"
}
```

Add `"test:ui": "vitest --ui"` only if `@vitest/ui` is installed.

### 1.4 Update TypeScript Config

Update `tsconfig.app.json`:

```jsonc
{
  "compilerOptions": {
    "types": ["vite/client", "vitest/globals"]
  }
}
```

### 1.5 Create Test Setup

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server'
import { useAuthStore } from '@/store/auth'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
  document.documentElement.className = ''
  document.body.className = ''
  useAuthStore.persist.clearStorage()
  useAuthStore.setState({ isAuthenticated: false })
})

afterAll(() => server.close())
```

Use `warn` while the suite is being built. Change to `error` in CI after all expected handlers exist.

### 1.6 Create Test Utilities

```tsx
// src/test/test-utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { Toaster } from 'sonner'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

type WrapperOptions = {
  routerProps?: MemoryRouterProps
  queryClient?: QueryClient
}

export function createWrapper(options: WrapperOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient()

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter {...options.routerProps}>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & WrapperOptions,
) {
  const { routerProps, queryClient, ...renderOptions } = options ?? {}

  return render(ui, {
    wrapper: createWrapper({ routerProps, queryClient }),
    ...renderOptions,
  })
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export { renderWithProviders as render }
```

### 1.7 Create MSW Server and Handlers

```typescript
// src/test/msw/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```typescript
// src/test/msw/handlers.ts
import { http, HttpResponse } from 'msw'
import type { AuthMeData } from '@/api/types'
import { createMockAuthMe } from '../fixtures'

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

export const mockAuthMeData: AuthMeData = createMockAuthMe()

export const handlers = [
  http.get('/api/auth/me', () => ok(mockAuthMeData)),
  http.get('/api/auth/refresh', () =>
    ok({ user: mockAuthMeData.user }, 'Session refreshed'),
  ),
  http.post('/api/auth/logout', () => emptyOk('Logged out')),
]
```

### 1.8 Create Fixtures

```typescript
// src/test/fixtures.ts
import type {
  AuthMeData,
  AuthenticatedUser,
  CapabilityKey,
  PaginationMeta,
  Permission,
  Post,
  Role,
  RoleName,
  RolePermissionAssignment,
  UserListItem,
} from '@/api/types'

let nextId = 1

export function resetMockIds() {
  nextId = 1
}

export function createPaginationMeta(
  total: number,
  page = 1,
  pageSize = 20,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  }
}

export function createMockUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  const id = nextId++
  return {
    id,
    fullname: `User ${id}`,
    email: `user${id}@test.com`,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function createMockAuthMe(
  overrides: Partial<AuthMeData> = {},
): AuthMeData {
  return {
    user: createMockUser({
      fullname: 'Test Admin',
      email: 'admin@test.com',
    }),
    roles: ['super-admin'],
    capabilities: [
      'users.view',
      'users.create',
      'users.update',
      'users.delete',
      'users.assignRole',
      'users.revokeRole',
      'roles.view',
      'roles.create',
      'roles.update',
      'roles.delete',
      'permissions.view',
      'permissions.create',
      'permissions.delete',
      'rolePermissions.view',
      'rolePermissions.assign',
      'rolePermissions.revoke',
      'posts.view',
      'posts.create',
      'posts.update',
      'posts.delete',
      'posts.createOnBehalf',
      'auditLogs.view',
      'migrations.view',
      'sessions.view',
      'sessions.revoke',
      'sessions.delete',
    ],
    ...overrides,
  }
}

export function createMockPost(overrides: Partial<Post> = {}): Post {
  const id = nextId++
  return {
    id,
    title: `Test Post ${id}`,
    content: 'Test content',
    owner_id: 1,
    owner_fullname: 'Test User',
    created_at: '2026-01-01T00:00:00.000Z',
    behalf_of: null,
    ...overrides,
  }
}

export function createMockUserListItem(
  overrides: Partial<UserListItem> = {},
): UserListItem {
  const id = nextId++
  return {
    id,
    fullname: `User ${id}`,
    email: `user${id}@test.com`,
    created_at: '2026-01-01T00:00:00.000Z',
    roles: ['user'],
    ...overrides,
  }
}

export function createMockRole(overrides: Partial<Role> = {}): Role {
  return {
    name: 'user',
    description: 'Default user role',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function createMockPermission(
  overrides: Partial<Permission> = {},
): Permission {
  const id = nextId++
  return {
    id,
    action: 'view',
    resource: 'post',
    description: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function createMockRolePermissionAssignment(
  overrides: Partial<RolePermissionAssignment> & {
    roleName?: RoleName
  } = {},
): RolePermissionAssignment {
  const { roleName, ...assignmentOverrides } = overrides

  return {
    id: nextId++,
    role: createMockRole({ name: roleName ?? 'user' }),
    permission: createMockPermission(),
    ...assignmentOverrides,
  }
}

export function capabilities(...items: CapabilityKey[]) {
  return items
}
```

### 1.9 Directory Structure After Phase 1

```
src/
├── test/
│   ├── fixtures.ts
│   ├── setup.ts
│   ├── test-utils.tsx
│   └── msw/
│       ├── handlers.ts
│       └── server.ts
├── utils/__tests__/
├── validation/__tests__/
├── components/
│   ├── __tests__/
│   ├── layout/__tests__/
│   └── ui/__tests__/
├── pages/__tests__/
└── ...
```

---

## Phase 2 — Unit Tests

Pure functions and schema rules should be tested first because they are fast and stable.

### 2.1 `utils/format.ts`

**File**: `src/utils/__tests__/format.test.ts`

| Test | What it covers |
|---|---|
| `formatDate` returns `"Not set"` for `null` | Null guard |
| `formatDate` returns `"Not set"` for `undefined` | Undefined guard |
| `formatDate` returns `"Not set"` for `""` | Empty string guard |
| `formatDate` formats a valid ISO date string | Happy path |
| `cx` joins truthy class names | Basic join |
| `cx` filters out `false`, `null`, `undefined` | Falsy filtering |
| `cx` returns `""` for all-falsy input | Edge case |

### 2.2 `utils/rolePermissions.ts`

**File**: `src/utils/__tests__/rolePermissions.test.ts`

| Test | What it covers |
|---|---|
| Returns empty array for empty input | Edge case |
| Groups assignments with the same `action:resource` key | Core grouping |
| Deduplicates duplicate roles inside a group | Duplicate guard |
| Sorts roles by `roleNames` order | Role ordering |
| Sorts groups by resource, then action | Group ordering |
| Handles a single assignment | Minimum input |

### 2.3 `validation/schemas.ts`

**File**: `src/validation/__tests__/schemas.test.ts`

| Schema | Key tests |
|---|---|
| `loginSchema` | Valid input, invalid email, password shorter than 4 chars, email trimming |
| `registerSchema` | Valid input, short name, long name, invalid email, password shorter than 8 chars |
| `createUserSchema` | Register fields plus valid/invalid `roleName` |
| `createRoleSchema` | Valid role name, invalid role name, description max length |
| `createPermissionSchema` | Valid action/resource, invalid enum values, description max length |
| `createPostSchema` | Title min/max, content max, empty optional `behalfUserId`, invalid/valid positive whole number |
| `editUserSchema` | Name min/max and trimming |
| `editRoleSchema` | Description max length |
| `editPostSchema` | Title min/max and content max |
| `assignRoleSchema` | Required positive `userId`, valid/invalid `roleName` |
| `rolePermissionSchema` | Valid/invalid `roleName`, `action`, and `resource` |
| `sessionIdSchema` | Required positive whole-number `sessionId` |
| `userIdSchema` | Required positive whole-number `userId` |

### 2.4 `api/client.ts`

**File**: `src/api/__tests__/client.test.ts`

| Test | What it covers |
|---|---|
| `getErrorMessage` returns an `Error` message | Happy path |
| `getErrorMessage` returns fallback for non-Error values | Fallback |
| `ApiClientError` stores status code, details, retry-after, and message | Error contract |

Do not over-test Axios internals. Add interceptor tests only if a regression appears around envelope unwrapping, refresh, or 429 warnings.

### 2.5 `constants.ts` and `navVisibility.ts`

**Files**:

- `src/__tests__/constants.test.ts`
- `src/components/layout/__tests__/navVisibility.test.ts`

| Test | What it covers |
|---|---|
| `queryKeys.authMe` is stable | Query key contract |
| `queryKeys.users(1, 20)` returns expected shape | Factory correctness |
| `queryKeys.users()` uses default values | Defaults |
| `visibleNavItem` keeps items without a capability | Public navigation |
| `visibleNavItem` hides items when capability is missing | RBAC filtering |
| `visibleNavItem` keeps a nav group only when at least one child is visible | Nested RBAC filtering |

---

## Phase 3 — Focused Integration Tests

These tests render components with real hooks/providers and mocked network responses through MSW.

### 3.1 First-Pass Scope

| Priority | Test target | Why |
|---|---|---|
| 1 | `AuthPage` | Login/register are entry-point flows |
| 2 | `ProtectedRoute` | Controls access to the app |
| 3 | `AppShell` and `navVisibility` | Central RBAC navigation behavior |
| 4 | `PostsPage` | Representative CRUD page |
| 5 | `Field`, `ConfirmDialog`, `EditDialog` as needed | Shared behavior for forms/dialogs |

Defer testing every CRUD page until the Posts pattern is stable.

### 3.2 Shared UI Components

#### `Field`

**File**: `src/components/ui/__tests__/FormFields.test.tsx`

| Test | What it covers |
|---|---|
| Renders label and input | Accessible form path |
| Shows error message when `error` prop is set | Form feedback |
| Sets `aria-invalid` when error exists | Accessibility |
| Omits error element when no error exists | Clean state |

#### `ConfirmDialog`

**File**: `src/components/ui/__tests__/Dialogs.test.tsx`

| Test | What it covers |
|---|---|
| Renders nothing when `open` is false | Closed state |
| Renders title, description, and action buttons when open | Open state |
| Calls `onConfirm` when confirm button is clicked | Destructive action |
| Calls `onClose` when cancel or backdrop is clicked | Cancel path |

#### Optional `EditDialog`

Add tests only if edit dialog regressions appear or if Posts edit tests become hard to diagnose.

### 3.3 `AuthPage`

**File**: `src/pages/__tests__/AuthPage.test.tsx`

| Test | What it covers |
|---|---|
| Renders login form by default | Default mode |
| Renders register form when `mode="register"` | Route-specific mode |
| Switches between Login and Bootstrap modes | Segmented control |
| Shows validation errors for invalid email and short password | Client validation |
| Calls login API and navigates to dashboard on valid login | Happy path |
| Fetches `/api/auth/me` after login success | Access data hydration |
| Shows error toast on failed login | Error handling |
| Register success resets form and returns to login mode | Bootstrap flow |

**MSW handlers needed**:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

### 3.4 `ProtectedRoute`

**File**: `src/components/__tests__/ProtectedRoute.test.tsx`

| Test | What it covers |
|---|---|
| Shows loading skeleton while auth query is pending | Loading state |
| Renders children when `/api/auth/me` returns access data | Authenticated path |
| Redirects to `/login` when auth and refresh fail with 401 | Unauthorized path |
| Shows API unavailable state on non-401 API failure | Server failure path |

For the 401 redirect case, mock both:

- `GET /api/auth/me` -> 401
- `GET /api/auth/refresh` -> 401

This is required because `api/client.ts` attempts refresh for non-login 401 responses.

### 3.5 `AppShell`

**File**: `src/components/layout/__tests__/AppShell.test.tsx`

| Test | What it covers |
|---|---|
| Renders navigation items allowed by capabilities | RBAC nav visibility |
| Hides capability-gated nav items the user lacks | RBAC restriction |
| Hides the Sessions group when no session child capability exists | Nested nav restriction |
| Shows user email and roles in the session box | Session display |
| Logout calls API, clears auth, and navigates to `/login` | Logout flow |

Use route entries like `/dashboard` or `/posts`. Avoid asserting CSS classes except when no better user-visible signal exists.

### 3.6 `PostsPage`

**File**: `src/pages/__tests__/PostsPage.test.tsx`

| Test | What it covers |
|---|---|
| Shows loading skeleton initially | Loading state |
| Renders posts from `/api/posts` | Data display |
| Shows `"No posts returned."` for an empty list | Empty state |
| Shows retryable error UI on API failure | Error state |
| Hides create panel without `posts.create` | RBAC gating |
| Shows create panel with `posts.create` | RBAC gating |
| Shows on-behalf field only with `posts.createOnBehalf` | RBAC sub-capability |
| Validates title min length | Form validation |
| Creates a normal post with `POST /api/posts` | Create flow |
| Creates on behalf with `POST /api/posts/on-behalf/:userId` | Delegated create flow |
| Opens edit dialog from Edit button | Edit flow |
| Updates a post with `PUT /api/posts/:id` | Update flow |
| Opens confirm dialog before delete | Delete confirmation |
| Deletes with `DELETE /api/posts/:id` after confirmation | Destructive flow |

**MSW handlers needed**:

- `GET /api/auth/me`
- `GET /api/posts`
- `POST /api/posts`
- `POST /api/posts/on-behalf/:userId`
- `PUT /api/posts/:id`
- `DELETE /api/posts/:id`

### 3.7 Deferred Integration Tests

| Deferred target | Add when |
|---|---|
| `UsersPage` | User create/update/delete or assign/revoke role behavior starts changing |
| `RolesPage` | Role create/update/delete behavior starts changing |
| `PermissionsPage` | Permission create/delete behavior starts changing |
| `RolePermissionsPage` | Assignment grouping or revoke/assign behavior changes |
| `SessionsPage` | Revoke/revoke-all session flows change |
| `AuditLogsPage` | Filters or audit display behavior becomes more complex |
| `MigrationsPage` | Migration status display gains conditions or actions |
| `DashboardPage` | It stops being mostly static summary UI |

---

## Phase 4 — Minimal E2E Tests

### 4.1 Configure Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
})
```

### 4.2 First Critical Journeys

Start with Playwright route mocking. Real-backend E2E is deferred until there is a stable test database seed and cleanup workflow.

| Test file | Journey | Steps |
|---|---|---|
| `e2e/auth.spec.ts` | Login flow | Mock login + auth-me, go to `/login`, submit credentials, verify dashboard |
| `e2e/auth.spec.ts` | Unauthorized redirect | Mock auth-me + refresh 401s, go to `/dashboard`, verify `/login` |
| `e2e/rbac.spec.ts` | Permission gating | Mock limited access data, verify restricted nav items are hidden |

Use the same backend envelope shape in route mocks that MSW uses.

### 4.3 Later E2E Expansion

| Test file | Journey | Add when |
|---|---|---|
| `e2e/posts.spec.ts` | Create post | Posts behavior becomes business-critical |
| `e2e/posts.spec.ts` | Delete post | You want one full destructive-action browser journey |
| `e2e/navigation.spec.ts` | Sidebar navigation | Navigation becomes complex or nested behavior changes |

---

## Direct Execution Checklist

### Phase 1 — Foundation

- [ ] Install Vitest, RTL, MSW, jsdom packages
- [ ] Optionally install `@vitest/ui`
- [ ] Update `vite.config.ts` with Vitest config
- [ ] Update `tsconfig.app.json` with `vitest/globals`
- [ ] Add test scripts to `package.json`
- [ ] Create `src/test/setup.ts`
- [ ] Create `src/test/test-utils.tsx`
- [ ] Create `src/test/msw/handlers.ts`
- [ ] Create `src/test/msw/server.ts`
- [ ] Create `src/test/fixtures.ts`
- [ ] Verify `pnpm test:run` starts successfully

### Phase 2 — Unit Tests

- [ ] `src/utils/__tests__/format.test.ts`
- [ ] `src/utils/__tests__/rolePermissions.test.ts`
- [ ] `src/validation/__tests__/schemas.test.ts`
- [ ] `src/api/__tests__/client.test.ts`
- [ ] `src/__tests__/constants.test.ts`
- [ ] `src/components/layout/__tests__/navVisibility.test.ts`
- [ ] Verify `pnpm test:coverage`

### Phase 3 — Focused Integration Tests

- [ ] `src/components/ui/__tests__/FormFields.test.tsx`
- [ ] `src/components/ui/__tests__/Dialogs.test.tsx`
- [ ] `src/components/__tests__/ProtectedRoute.test.tsx`
- [ ] `src/components/layout/__tests__/AppShell.test.tsx`
- [ ] `src/pages/__tests__/AuthPage.test.tsx`
- [ ] `src/pages/__tests__/PostsPage.test.tsx`
- [ ] Verify `pnpm test:run`

### Phase 4 — Minimal E2E

- [ ] Install Playwright
- [ ] Create `playwright.config.ts`
- [ ] `e2e/auth.spec.ts`
- [ ] `e2e/rbac.spec.ts`
- [ ] Verify `pnpm e2e`

---

## Key Principles

1. **Test behavior, not implementation** — click the button, do not call `setState`.
2. **Mock the network, not the hooks** — let React Query, Axios, and page code run normally.
3. **Use backend envelope shapes** — the API client unwraps them in production and tests.
4. **Reset shared state** — clear QueryClient cache, MSW handlers, localStorage, Zustand persisted auth, and DOM classes between tests.
5. **Keep E2E small at first** — browser tests prove critical journeys, not every branch.
6. **Coverage is a compass** — do not add a strict coverage gate until meaningful tests exist.
