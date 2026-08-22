# Vitest, from pnpm test to assertion

> **Scope**: How Vitest is configured, bootstrapped, and executes tests in this project.
> **Entry point**: `pnpm test` → `vitest` CLI.

---

## 1. Trigger: the CLI command

| Script | Command | Mode |
|---|---|---|
| `pnpm test` | `vitest` | Watch mode (re-runs on file change) |
| `pnpm test:run` | `vitest run` | Single run, then exit |
| `pnpm test:coverage` | `vitest run --coverage` | Single run + V8 coverage report |

**File**: [`package.json`](../../package.json)  
```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

**What happens**: The `vitest` binary (from `node_modules/.bin/vitest`) boots and immediately looks for a config file.

---

## 2. Config resolution

Vitest uses the **same config file as Vite**. There is no separate `vitest.config.ts`.

**File**: [`vite.config.ts`](../../vite.config.ts)

```ts
import { defineConfig } from 'vitest/config'   // ← NOT from 'vite'

export default defineConfig({
  // ... vite plugins, aliases, server config ...
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
      exclude: ['src/test/**', 'src/api/schema.ts', 'src/main.tsx', 'src/**/*.d.ts'],
    },
  },
})
```

> [!IMPORTANT]
> `defineConfig` is imported from `vitest/config` (not `vite`). This is what gives the `test` key full type-safety. Vitest merges this with Vite's own config, so plugins like `@vitejs/plugin-react` and `@tailwindcss/vite` are still active during test transforms.

### Key config decisions

| Option | Value | Effect |
|---|---|---|
| `globals: true` | | Injects `describe`, `it`, `expect`, `vi` etc. into every test file without imports. Requires `"types": ["vitest/globals"]` in tsconfig. |
| `environment: 'jsdom'` | | Every test worker boots a **jsdom** instance (a headless DOM implementation) so `document`, `window`, `localStorage` etc. exist. |
| `setupFiles` | `['./src/test/setup.ts']` | Executed **once per worker** before any test file runs. This is the bootstrap hook. |
| `css: true` | | CSS imports are processed instead of being stubbed. Relevant because Tailwind classes are used in components. |
| `include` | `['src/**/*.test.{ts,tsx}']` | Only files matching this glob are treated as test files. |
| `coverage.provider` | `'v8'` | Uses V8's built-in code coverage instead of Istanbul. Faster, native. |

---

## 3. TypeScript compilation

Before test files execute, Vitest uses **Vite's transform pipeline** (esbuild under the hood) to compile TypeScript → JavaScript on-the-fly. No separate `tsc` step is needed.

**File**: [`tsconfig.app.json`](../../tsconfig.app.json)

```json
"types": ["vite/client", "vitest/globals"]
```

This line is what makes the globals type-check. It tells TypeScript that `describe`, `it`, `expect`, `vi`, `beforeAll`, `afterEach`, etc. exist as globals so the compiler doesn't complain even though they are never imported in test files (when `globals: true` is set in vitest config).

**Chain**: `tsconfig.app.json` types → TypeScript knows about vitest globals → no import needed in test files.

---

## 4. Setup file execution, the bootstrap

**File**: [`src/test/setup.ts`](../../src/test/setup.ts)

This file runs **once per Vitest worker thread**, before any `*.test.ts` file in that worker.

```ts
import '@testing-library/jest-dom/vitest'      // ① Extend matchers
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw/server'           // ② Import MSW server
import { resetMockIds } from './fixtures'
import { useAuthStore } from '@/store/auth'
```

### Step-by-step execution order

```
┌───────────────────────────────────────────────────────────────┐
│  1. jsdom environment boots (window, document, localStorage)  │
│  2. setup.ts is loaded and executed:                          │
│     a. jest-dom matchers are injected into Vitest's expect    │
│     b. window.matchMedia is polyfilled (jsdom lacks it)       │
│     c. beforeAll → MSW server starts listening                │
│     d. afterEach hooks are registered (cleanup, reset, etc.)  │
│     e. afterAll → MSW server closes                           │
│  3. First *.test.ts file in the worker is loaded & executed   │
│  4. afterEach fires after each `it()` block                   │
│  5. afterAll fires after ALL tests in the worker complete     │
└───────────────────────────────────────────────────────────────┘
```

### What each hook does

| Hook | Action | Why |
|---|---|---|
| `beforeAll` | `server.listen({ onUnhandledRequest: 'warn' })` | Start the MSW interceptor. Any HTTP request not covered by a handler logs a warning. |
| `afterEach` | `cleanup()` | RTL unmounts all rendered React trees from jsdom. |
| `afterEach` | `server.resetHandlers()` | Remove any per-test `server.use(...)` overrides, restore default handlers. |
| `afterEach` | `resetMockIds()` | Reset the auto-incrementing ID counter in fixtures back to 1. |
| `afterEach` | `localStorage.clear()` | Wipe jsdom's localStorage to prevent state bleed. |
| `afterEach` | `document.documentElement.className = ''` | Clear any CSS classes set on `<html>` (e.g., dark mode). |
| `afterEach` | `useAuthStore.persist.clearStorage()` | Clear Zustand's persisted auth state from localStorage. |
| `afterEach` | `useAuthStore.setState(...)` | Force-reset the auth store's in-memory state to `{ isAuthenticated: false }`. |
| `afterAll` | `server.close()` | Tear down the MSW interceptor. |

### The matchMedia polyfill

```ts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})
```

> [!NOTE]
> jsdom does not implement `window.matchMedia`. Many UI libraries (Tailwind dark-mode, responsive hooks) call it. This polyfill prevents `TypeError: window.matchMedia is not a function` crashes. It always returns `matches: false`.

---

## 5. Test discovery and execution

Vitest scans for files matching `src/**/*.test.{ts,tsx}` (from `test.include` in config).

### The 12 test files it finds

| Kind | Files |
| --- | --- |
| Unit | `src/__tests__/constants.test.ts`, `src/api/__tests__/client.test.ts`, `src/utils/__tests__/rolePermissions.test.ts`, `src/utils/__tests__/format.test.ts`, `src/validation/__tests__/schemas.test.ts`, `src/components/layout/__tests__/navVisibility.test.ts` |
| Component | `src/pages/__tests__/AuthPage.test.tsx`, `src/pages/__tests__/PostsPage.test.tsx`, `src/components/__tests__/ProtectedRoute.test.tsx`, `src/components/ui/__tests__/FormFields.test.tsx`, `src/components/ui/__tests__/Dialogs.test.tsx`, `src/components/layout/__tests__/AppShell.test.tsx` |

Note that `e2e/*.spec.ts` is outside the `include` glob, so Vitest never picks up
the Playwright specs. That separation is on purpose.

### One of them, in full

**File**: [`src/__tests__/constants.test.ts`](../../src/__tests__/constants.test.ts)

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, queryKeys } from '../constants'

describe('queryKeys', () => {
  it('keeps auth and paginated key shapes stable', () => {
    expect(queryKeys.authMe).toEqual(['auth', 'me'])
    expect(queryKeys.users(1, 20)).toEqual(['users', { page: 1, pageSize: 20 }])
    expect(queryKeys.users()).toEqual(['users', { page: 1, pageSize: DEFAULT_PAGE_SIZE }])
    expect(queryKeys.userSessions(7, 2, 10)).toEqual(
      ['user-sessions', 7, { page: 2, pageSize: 10 }]
    )
  })
})
```

> [!NOTE]
> Even though `globals: true` means `describe`, `it`, `expect` are available without imports, this test explicitly imports them from `vitest`. Both approaches work. Explicit imports are a style choice.

---

## 6. Coverage collection

When `pnpm test:coverage` runs:

1. Vitest enables the **V8 coverage provider** (`@vitest/coverage-v8` package).
2. V8 natively tracks which lines/branches/functions execute during tests.
3. After all tests complete, Vitest generates reports in 3 formats:
   - `text`, printed to the terminal
   - `html`, a browsable report in `coverage/`
   - `lcov`, machine-readable for CI tools

Coverage only includes files matching `src/**/*.{ts,tsx}`, excluding test infrastructure, generated schema, the entry point, and type declarations.

---

## 7. Full execution chain

```
pnpm test
  │
  ▼
vitest CLI boots
  │
  ▼
Reads vite.config.ts
  ├─ Discovers test.environment = 'jsdom'
  ├─ Discovers test.setupFiles = ['./src/test/setup.ts']
  ├─ Discovers test.include = ['src/**/*.test.{ts,tsx}']
  └─ Discovers test.globals = true
  │
  ▼
Spawns worker thread(s)
  │
  ▼
Each worker:
  ├─ Boots jsdom (creates window, document, navigator, localStorage)
  ├─ Injects vitest globals (describe, it, expect, vi, etc.)
  ├─ Loads & executes src/test/setup.ts
  │    ├─ Extends expect with jest-dom matchers (.toBeVisible(), etc.)
  │    ├─ Polyfills window.matchMedia
  │    ├─ Registers beforeAll → MSW server.listen()
  │    ├─ Registers afterEach → cleanup + state reset
  │    └─ Registers afterAll → MSW server.close()
  │
  ▼
  ├─ beforeAll fires → MSW server starts
  │
  ▼
  ├─ Loads src/__tests__/constants.test.ts
  │    ├─ describe('queryKeys') registered
  │    ├─ it('keeps auth and paginated key shapes stable') runs
  │    │    ├─ expect(queryKeys.authMe).toEqual(...)  → PASS/FAIL
  │    │    ├─ expect(queryKeys.users(1, 20)).toEqual(...)  → PASS/FAIL
  │    │    └─ ... more assertions ...
  │    └─ afterEach fires → cleanup, resetHandlers, resetMockIds, etc.
  │
  ▼
  ├─ afterAll fires → MSW server closes
  │
  ▼
Results aggregated → printed to terminal
  │
  ▼
(If --coverage) → V8 coverage report generated in coverage/
```

---

## 8. File dependency map

```
package.json  ──"test": "vitest"──▶  vitest CLI
                                        │
                                        ▼
                                  vite.config.ts
                                   (test block)
                                        │
                              ┌─────────┼─────────┐
                              ▼         ▼         ▼
                       tsconfig     jsdom      setupFiles
                      .app.json    env boot        │
                         │                         ▼
                         │               src/test/setup.ts
                         │                    │
                         │         ┌──────────┼──────────────┐
                         │         ▼          ▼              ▼
                         │   @testing-lib/  msw/server.ts  fixtures.ts
                         │   jest-dom          │
                         │                     ▼
                         │              msw/handlers.ts
                         │
                         ▼
                  src/**/*.test.{ts,tsx}  ◀── test discovery
```

---

## 9. Where this shows up

**A new test file is ignored.** It sits outside `src/`, or it is named
`*.spec.ts`. The `include` glob is `src/**/*.test.{ts,tsx}` and nothing else runs.

**`describe` is not defined, in the editor only.** `globals: true` puts it on the
runtime global, but TypeScript only believes it because of
`"types": ["vitest/globals"]` in `tsconfig.app.json`. Drop that line and the tests
still pass while the editor turns red.

**Every test suddenly makes real network calls.** Something removed
`setupFiles`, so `src/test/setup.ts` never ran, so MSW never started listening.
The failure looks like a timeout, not a config error.

**A test passes alone and fails in the suite.** State from the previous test
survived. The `afterEach` block in `setup.ts` clears the DOM, the MSW overrides,
the fixture counter, `localStorage` and the auth store for exactly this reason.

---

Previous: [Client testing index](./README.md).
Next: [React Testing Library](./React_Testing_library.doc.md), what renders a component into the jsdom Vitest just booted.
