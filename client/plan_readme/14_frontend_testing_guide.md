# Frontend Testing — A Complete Guide

> From zero knowledge to production-grade patterns.
> All examples reference patterns found in **this** RoleControl IAM client app.

---

## Table of Contents

1. [Why Test?](#1-why-test)
2. [The Testing Pyramid](#2-the-testing-pyramid)
3. [Nomenclature Dictionary](#3-nomenclature-dictionary)
4. [The Toolchain](#4-the-toolchain)
5. [Unit Tests](#5-unit-tests)
6. [Integration Tests](#6-integration-tests)
7. [End-to-End (E2E) Tests](#7-end-to-end-e2e-tests)
8. [What to Test vs What NOT to Test](#8-what-to-test-vs-what-not-to-test)
9. [Testing Patterns & Principles](#9-testing-patterns--principles)
10. [When to Write Tests](#10-when-to-write-tests)
11. [Code Coverage — What It Really Means](#11-code-coverage)
12. [Recommended Reading](#12-recommended-reading)

---

## 1. Why Test?

### The Problem Without Tests

Imagine you refactor `groupRolePermissionAssignments()` in `utils/rolePermissions.ts`. It works for the two cases you manually checked. But did you check the edge case where assignments is empty? Where two assignments share the same permission but different roles? You ship it, and the Role Permissions page silently breaks for a subset of users.

### What Tests Give You

| Benefit | Explanation |
|---|---|
| **Confidence to refactor** | Change code knowing that if tests pass, behavior is preserved |
| **Regression prevention** | A bug you fix today won't silently reappear next month |
| **Living documentation** | Tests describe *what the code should do*, not just what it does now |
| **Faster feedback** | Catch errors in seconds, not after a deploy + manual QA cycle |
| **Design pressure** | Hard-to-test code is often hard-to-maintain code. Tests nudge you toward better design |

> **💡 The #1 goal of testing is confidence** — confidence that your code works correctly and that changes don't break existing behavior.

---

## 2. The Testing Pyramid

```
        ╱╲
       ╱E2E╲          Few, slow, expensive, high confidence
      ╱──────╲
     ╱Integr- ╲       Medium count, medium speed
    ╱  ation    ╲
   ╱─────────────╲
  ╱    Unit        ╲   Many, fast, cheap, focused
 ╱──────────────────╲
```

| Layer | What it tests | Speed | Count | Example from our app |
|---|---|---|---|---|
| **Unit** | A single function or module in isolation | ⚡ ms | Many | `formatDate()`, `groupRolePermissionAssignments()`, Zod schemas |
| **Integration** | Multiple units working together, often a component + its hooks + mocked API | 🔄 ~seconds | Medium | `<AuthPage />` renders, validates, and calls the login mutation |
| **E2E** | The full app in a real browser, real clicks, sometimes real backend | 🐢 seconds-minutes | Few | Log in → navigate to Posts → create a post → see it in the list |

> **⚠️ Key insight**: You want *most* tests at the bottom (unit), a good number in the middle (integration), and only a handful at the top (E2E). Best ratio of confidence-to-cost.

### The "Testing Trophy" (Modern React variant)

Kent C. Dodds (creator of React Testing Library) popularized a shifted model:

```
        ╱╲
       ╱E2E╲
      ╱──────╲
     ╱Integr-  ╲      ← Write MOST tests here for React apps
    ╱  ation     ╲
   ╱──────────────╲
  ╱   Unit          ╲
 ╱───────────────────╲
 ──── Static ─────────   ← TypeScript + ESLint (you already have this!)
```

For React apps, **integration tests** (component tests with mocked APIs) give you the most bang for your buck. You already get "static analysis" for free from TypeScript and ESLint.

### Two Valid Approaches for This Project

There are two reasonable ways to apply production frontend testing ideas to this app.

#### Approach A — Full Production-Style Coverage

This means testing most utilities, most shared components, most pages, important hooks, API states, and several E2E journeys.

| Pros | Cons |
|---|---|
| Very broad regression protection | A lot to learn at once |
| Looks close to larger company test suites | Slower to implement for a small app |
| Catches many page-specific bugs | Can become checklist testing instead of risk-based testing |
| Good once the app is stable and growing | More mocks, fixtures, handlers, and maintenance |

This approach is not wrong. It is where mature apps often end up. The problem is that it adds too many moving parts for a first testing pass: MSW handlers for every page, lots of fixtures, many similar CRUD tests, coverage pressure, and Playwright setup complexity.

#### Approach B — Trimmed Production-Minded First Pass

This means using the same professional tools, but testing the highest-risk behavior first:

- auth login/register behavior
- protected route behavior
- RBAC navigation and UI gating
- validation schemas
- API loading, empty, success, and error states
- one representative CRUD page, such as Posts
- a tiny E2E suite for critical browser journeys

| Pros | Cons |
|---|---|
| Beginner-friendly without using toy tools | Does not cover every page immediately |
| Easier to explain in interviews | Some regressions in less critical pages may still need manual testing |
| Teaches real production patterns: RTL, MSW, Playwright | Requires discipline to expand coverage later |
| Focuses on risk instead of line count | Coverage percentage may start lower |

**Chosen approach for this app:** Approach B first, then grow toward Approach A when the patterns feel comfortable.

Interview explanation:

> I used production tools, but I did not try to test every file on day one. I started with the highest-risk behavior: auth, protected routes, RBAC, validation, API states, and one CRUD flow. That gives real confidence without overengineering a small learning app.

---

## 3. Nomenclature Dictionary

These are terms you'll encounter constantly. Bookmark this section.

### Core Concepts

| Term | Definition | Our App Example |
|---|---|---|
| **Test Runner** | The program that discovers, executes, and reports test results | **Vitest** (what we'll use) |
| **Assertion** | A statement that checks if a value matches an expectation | `expect(formatDate(null)).toBe('Not set')` |
| **Test Suite** | A group of related tests, usually one file | `formatDate.test.ts` |
| **Test Case** | A single test within a suite | `it('returns "Not set" for null input', ...)` |
| **SUT** | "System Under Test" — the thing you're testing | `formatDate` function in a test for `formatDate` |
| **Fixture** | Pre-built test data that you reuse across tests | A fake `RolePermissionAssignment[]` array |

### Test Doubles (Fakes that replace real dependencies)

| Term | What it does | When to use it |
|---|---|---|
| **Mock** | A fake implementation you can inspect (was it called? with what args?) | Replace `authApi.login` to verify it was called with `{email, password}` |
| **Stub** | A fake that returns a pre-determined value, no inspection needed | Make `useAuthMe()` always return a specific user object |
| **Spy** | Wraps a real function, lets it run, but records calls | Watch `console.error` during ErrorBoundary tests |
| **Fake** | A simplified but functional implementation | An in-memory version of localStorage |

> **📝 Note:** In practice, people use "mock" loosely to mean any test double. Libraries like Vitest blur the lines — `vi.fn()` creates something that's both a mock and a stub.

### Patterns

| Term | Definition |
|---|---|
| **AAA Pattern** | **A**rrange → **A**ct → **A**ssert. The universal structure of every test |
| **Given-When-Then** | Same as AAA but in BDD language: Given [setup], When [action], Then [expected result] |
| **Test Isolation** | Each test runs independently — no shared state between tests |
| **Snapshot Testing** | Capture a component's rendered output, compare against a saved snapshot on future runs |
| **Code Coverage** | A metric showing what % of your code is executed by tests (lines, branches, functions) |
| **TDD** | Test-Driven Development: write the test *first*, then the code to make it pass |
| **Flaky Test** | A test that sometimes passes and sometimes fails without code changes. The enemy. |
| **Regression** | A previously working feature that breaks due to a code change |

### React-Specific Terms

| Term | Definition |
|---|---|
| **Render test** | Verify a component renders without crashing |
| **User event** | Simulating real user interactions (click, type, tab) rather than firing DOM events directly |
| **Query** | How you find elements in a rendered component: `getByRole`, `getByText`, `findByText` |
| **Screen** | The `screen` object from RTL — represents the rendered DOM |
| **Provider wrapper** | A test utility that wraps components with required context providers (QueryClient, Router, etc.) |

---

## 4. The Toolchain

What production-grade React apps use in 2026, and what we'll adopt:

| Tool | Purpose | Why this one? |
|---|---|---|
| **Vitest** | Test runner + assertions | Built by Vite team, shares your Vite config, instant startup, Jest-compatible API |
| **React Testing Library (RTL)** | Component rendering + queries | Tests components the way users use them; nudges you toward accessibility |
| **@testing-library/user-event** | Realistic interactions | Simulates real typing, clicking, tabbing (not just firing synthetic events) |
| **MSW (Mock Service Worker)** | API mocking at network level | Your component code runs exactly as in production — just hits a mock server |
| **Playwright** | E2E testing in real browsers | Auto-waits, multi-browser, traces, screenshots |

```
┌─────────────────────────────────────────┐
│           Your Test Stack               │
├─────────────────────────────────────────┤
│  Vitest          → runs tests, asserts  │
│  RTL             → renders components   │
│  user-event      → simulates clicks     │
│  MSW             → mocks HTTP layer     │
│  Playwright      → real browser E2E     │
│  TypeScript      → static analysis      │
│  ESLint          → code quality         │
└─────────────────────────────────────────┘
```

### Current Codebase Alignment Notes

The testing criteria in this guide should follow the actual client code as it exists now:

| Area | Correct detail for this app |
|---|---|
| Vitest config | Import `defineConfig` from `vitest/config` when adding the `test` block to `vite.config.ts` |
| API mocks | Return backend envelopes like `{ success, message, data, timestamp }` because `api/client.ts` unwraps success responses |
| Auth 401 tests | Mock both `/api/auth/me` and `/api/auth/refresh`; the Axios interceptor attempts refresh for non-login 401 responses |
| App shell | `AppShell` lives in `src/components/layout/AppShell.tsx` |
| RBAC nav logic | `visibleNavItem()` lives in `src/components/layout/navVisibility.ts` and is a good unit-test target |
| Capabilities | Use generated capability keys, including `users.assignRole` and `users.revokeRole`; do not invent `userRoles.*` keys |
| Posts fixtures | `Post` has no `updated_at` field |
| Pagination fixtures | `PaginationMeta` uses `total`, not `totalCount` |
| Toast assertions | Include Sonner's `<Toaster />` in integration test providers when asserting toast messages |

The detailed implementation checklist with corrected snippets lives in `08_testing_implementation_plan.md`.

---

## 5. Unit Tests

### What They Test

Pure functions, utility logic, data transformations — anything that takes input and returns output without side effects.

### In Our App, These Are Unit-Testable

| File | Functions | Why Unit Test? |
|---|---|---|
| `utils/format.ts` | `formatDate()`, `cx()` | Pure functions, no dependencies |
| `utils/rolePermissions.ts` | `groupRolePermissionAssignments()` | Complex data transformation with sorting |
| `validation/schemas.ts` | All Zod schemas | Validation logic with edge cases |
| `api/client.ts` | `getErrorMessage()`, `ApiClientError` | Pure class/function |
| `constants.ts` | `queryKeys` factory functions | Ensure stable key shapes |
| `components/layout/navVisibility.ts` | `hasCapability()`, `visibleNavItem()` | RBAC navigation filtering |

### Example: Testing `formatDate`

```typescript
// src/utils/__tests__/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatDate, cx } from '../format'

describe('formatDate', () => {
  it('returns "Not set" for null', () => {
    expect(formatDate(null)).toBe('Not set')
  })

  it('returns "Not set" for undefined', () => {
    expect(formatDate(undefined)).toBe('Not set')
  })

  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-01-15T10:30:00Z')
    expect(result).not.toBe('Not set')
    expect(result).toContain('2026')
  })
})

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c')
  })

  it('filters out falsy values', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b')
  })
})
```

### Example: Testing a Zod Schema

```typescript
// src/validation/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { loginSchema } from '../schemas'

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'admin@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from email', () => {
    const result = loginSchema.safeParse({
      email: '  admin@example.com  ',
      password: 'password123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('admin@example.com')
    }
  })
})
```

---

## 6. Integration Tests

### What They Test

A React component rendered with its hooks, context providers, and mocked API responses — simulating how a real user would interact with it.

### The Key Idea

> "The more your tests resemble the way your software is used, the more confidence they can give you." — Kent C. Dodds

You don't test that `useState` was called. You test that **when the user types an invalid email and clicks submit, they see an error message**.

### Provider Wrapper Pattern

Our app needs `QueryClientProvider`, router context, and sometimes Sonner's toaster. We create a reusable test wrapper:

```tsx
// src/test/test-utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,       // Don't retry in tests — fail fast
        retryOnMount: false,
      },
      mutations: { retry: false },
    },
  })
}

type WrapperOptions = {
  routerProps?: MemoryRouterProps
}

export function createWrapper(options: WrapperOptions = {}) {
  const queryClient = createTestQueryClient()
  return function TestProviders({ children }: { children: ReactNode }) {
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
  ui: React.ReactElement,
  options?: RenderOptions & WrapperOptions,
) {
  const { routerProps, ...renderOptions } = options ?? {}

  return render(ui, {
    wrapper: createWrapper({ routerProps }),
    ...renderOptions,
  })
}

export * from '@testing-library/react'
export { renderWithProviders as render }
```

When using MSW with this app, default handlers should return the same success envelope shape that the backend returns:

```typescript
HttpResponse.json({
  success: true,
  message: 'OK',
  data: { posts: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
  timestamp: '2026-01-01T00:00:00.000Z',
})
```

### How MSW Works

```
Without MSW (production):
  Component → axios → Network → Real Server → Response

With MSW (tests):
  Component → axios → MSW intercepts → Mock Handler → Response
                       ↑
                  Your component code
                  doesn't know the difference!
```

### Example: Testing a Form Component

```tsx
// Simplified example showing the pattern
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { AuthPage } from '../AuthPage'

describe('AuthPage', () => {
  it('shows validation error for invalid email on blur', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)

    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'not-valid')
    await user.tab()  // trigger blur validation

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument()
  })
})
```

---

## 7. End-to-End (E2E) Tests

### What They Test

The full application running in a real browser. Real clicks, real navigation, real rendering.

### Example with Playwright

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test('user can log in and see the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('admin@example.com')
  await page.getByLabel(/password/i).fill('securepassword')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/dashboard/)
})

test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/login/)
})
```

### When to Use E2E vs Integration

| Use E2E for | Use Integration for |
|---|---|
| Critical user journeys (login, CRUD) | Individual component behavior |
| Cross-page navigation | Form validation feedback |
| Cookie/session behavior | Loading/error states |

---

## 8. What to Test vs What NOT to Test

### ✅ DO Test

- **Business logic**: `groupRolePermissionAssignments()`, Zod validation rules
- **User interactions**: Form submit, button clicks, dialog open/close
- **Conditional rendering**: RBAC-gated UI (`can("posts.create")` shows/hides the create panel)
- **Error states**: What happens when API returns 401, 500, network error
- **Edge cases**: Empty lists, null values, boundary values

### ❌ DON'T Test

- **Third-party library internals**: Don't test that `react-hook-form` validates — test that *your schema* rejects bad input
- **Implementation details**: Don't test that `useState` was called or a specific CSS class was applied
- **Generated code**: Don't test `schema.ts` (auto-generated from OpenAPI)
- **Framework behavior**: Don't test that `<Route>` renders the right component

---

## 9. Testing Patterns & Principles

### The AAA Pattern (Every Test)

```typescript
it('groups assignments by permission key', () => {
  // ARRANGE — set up the preconditions
  const assignments = [mockAssignment({ action: 'view', resource: 'post' })]

  // ACT — perform the action
  const result = groupRolePermissionAssignments(assignments)

  // ASSERT — verify the outcome
  expect(result).toHaveLength(1)
  expect(result[0].roles).toEqual(['admin'])
})
```

### Test Naming Convention

```typescript
// ❌ Bad
it('test1', ...)
it('works', ...)

// ✅ Good
it('returns "Not set" when value is null', ...)
it('shows validation error when email format is invalid', ...)
it('hides create panel when user lacks posts.create capability', ...)
```

### RTL Querying Priority

```
1. getByRole        ← Best. Tests accessibility for free.
2. getByLabelText   ← Great for form fields.
3. getByText        ← Good for non-interactive elements.
4. getByTestId      ← Last resort only.
```

### Async Queries

| Query | Behavior |
|---|---|
| `getBy*` | Returns immediately, throws if not found |
| `queryBy*` | Returns immediately, returns `null` if not found (assert absence) |
| `findBy*` | Waits for element to appear — use for async data |

---

## 10. When to Write Tests

### Priority Order

| Priority | What | Why |
|---|---|---|
| 🔴 High | Utility functions, validators, data transformations | Cheap to test, high value |
| 🔴 High | Auth flow (login, logout, token refresh) | Security-critical |
| 🟡 Medium | CRUD forms (create, edit, delete) | Complex user interactions |
| 🟡 Medium | RBAC-conditional rendering | Business logic in UI |
| 🟢 Lower | Static pages, layout components | Low bug probability |

---

## 11. Code Coverage

### What It Measures

| Metric | Meaning |
|---|---|
| Line coverage | % of source code lines executed by tests |
| Branch coverage | % of if/else/ternary branches taken |
| Function coverage | % of functions called at least once |

### Realistic Targets

| Target | Scope |
|---|---|
| **First target: meaningful critical-flow coverage** | Better first milestone than chasing a number |
| **Later target: 70-80% overall** | Reasonable once test patterns are stable |
| **95%+ for utils/validation** | Pure logic should be thoroughly covered |
| **70%+ for components** | Hard to reach 100% without diminishing returns |

> **⚠️ 100% coverage does NOT mean 0 bugs.** Coverage tells you what code *ran*, not whether the assertions were *meaningful*. Treat it as a guide, not a goal.

### What We Are Intentionally Avoiding at First

| Avoid for now | Why it adds complexity | When to add it later |
|---|---|---|
| Testing every page component | Requires many MSW handlers and repetitive fixtures | When one page pattern is stable |
| Testing visual class names everywhere | Couples tests to CSS implementation | For design-system components or visual regressions |
| Large snapshot tests | Snapshots often pass without proving behavior | Rarely, for stable serialized output |
| Real-backend E2E with seeded DB | Requires DB setup, auth seed users, cleanup, and CI orchestration | When backend test infrastructure exists |
| Strict coverage gates on day one | Encourages shallow tests just to raise numbers | After meaningful tests already exist |
| Mocking internal hooks heavily | Tests implementation instead of user behavior | Only when isolating a genuinely hard dependency |

The production pattern is not "test everything immediately." The production pattern is **risk-based testing with maintainable tools**.

---

## 12. Recommended Reading

| Resource | Why |
|---|---|
| [Testing Library Docs](https://testing-library.com/docs/) | The philosophy + API reference |
| [Vitest Docs](https://vitest.dev/) | Test runner configuration and API |
| [MSW Docs](https://mswjs.io/) | Network-level API mocking |
| [Playwright Docs](https://playwright.dev/) | E2E testing |
| [Common RTL mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) | Avoid bad habits from day one |
