# React Testing Library, rendering and querying

> **Scope**: How RTL integrates with Vitest to render React components, simulate user interactions, and assert on DOM state.
> **Core principle**: Test components the way a real user interacts with them: by visible text, roles, and labels, never by implementation details.

---

## 1. What RTL is, and what it is not

RTL is **not a test runner**. It cannot discover or execute tests on its own. It is a **rendering + querying utility** that sits on top of Vitest (the runner) and jsdom (the DOM).

| Layer | Tool | Role |
|---|---|---|
| Test runner | **Vitest** | Discovers `*.test.tsx` files, runs `describe`/`it`, reports pass/fail |
| DOM environment | **jsdom** | Provides `document`, `window`, `HTMLElement`, etc. in Node.js |
| Rendering | **@testing-library/react** | `render()` → mounts a React component tree into jsdom |
| Querying | **@testing-library/react** | `getByRole()`, `getByText()`, `findByText()`, etc. |
| User simulation | **@testing-library/user-event** | `userEvent.click()`, `.type()`, `.keyboard()`, realistic event firing |
| Custom matchers | **@testing-library/jest-dom** | `toBeVisible()`, `toBeInTheDocument()`, `toHaveTextContent()`, etc. |

### Installed packages

**File**: [`package.json`](../../package.json)

```json
"@testing-library/jest-dom": "^6.9.1",
"@testing-library/react": "^16.3.2",
"@testing-library/user-event": "^14.6.1",
```

---

## 2. Matcher extension, jest-dom into Vitest

**File**: [`src/test/setup.ts`](../../src/test/setup.ts), line 1

```ts
import '@testing-library/jest-dom/vitest'
```

### What this does

1. Imports the `@testing-library/jest-dom/vitest` entry point.
2. That module calls `expect.extend(...)` to add **~40 custom matchers** to Vitest's `expect()`.
3. These matchers are now available in every test file.

### Matchers added, the ones used most

| Matcher | What it checks |
|---|---|
| `.toBeInTheDocument()` | Element exists in the jsdom document |
| `.toBeVisible()` | Element is not hidden by CSS (`display:none`, `visibility:hidden`, etc.) |
| `.toHaveTextContent('...')` | Element's text content matches |
| `.toBeDisabled()` | Element has `disabled` attribute |
| `.toHaveValue('...')` | Form input has a specific value |
| `.toHaveClass('...')` | Element has a specific CSS class |
| `.toBeChecked()` | Checkbox/radio is checked |

> [!IMPORTANT]
> The import path is `@testing-library/jest-dom/vitest` (not just `@testing-library/jest-dom`). The `/vitest` sub-path uses Vitest's `expect.extend()` API instead of Jest's. Using the wrong path would silently fail.

---

## 3. The custom render in `test-utils.tsx`

RTL's raw `render()` mounts a component into a bare `<div>`. But real app components need **providers** (router, query client, toaster). This project wraps `render()` with providers.

**File**: [`src/test/test-utils.tsx`](../../src/test/test-utils.tsx)

### 3a. Test query client

```ts
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,       // ← Don't retry failed requests in tests
        retryOnMount: false,
        gcTime: 0,          // ← Immediately garbage-collect query cache
      },
      mutations: {
        retry: false,
      },
    },
  })
}
```

> [!TIP]
> `retry: false` is critical for tests. Without it, a test expecting a failed request would hang for multiple retry attempts before failing. `gcTime: 0` ensures no stale data leaks between tests.

### 3b. Provider wrapper

```ts
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
```

**The wrapper provides 3 things:**

| Provider | Purpose |
|---|---|
| `QueryClientProvider` | Any component using `useQuery` / `useMutation` needs this. Without it → `"No QueryClient set"` error. |
| `MemoryRouter` | Any component using `useNavigate`, `<Link>`, `useParams` needs a router. `MemoryRouter` is an in-memory router that doesn't need a real URL bar. Test can set initial route via `routerProps`. |
| `Toaster` | Components that call `toast.success()` / `toast.error()` need the Sonner toaster mounted to actually render toast notifications in jsdom. |

### 3c. The `renderWithProviders` function

```ts
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
```

This is the function test files import as `render`. It calls RTL's real `render()` with the wrapper injected.

### 3d. Re-exports

```ts
export * from '@testing-library/react'           // screen, waitFor, within, etc.
export { default as userEvent } from '@testing-library/user-event'
export { renderWithProviders as render }          // ← shadows the raw render
```

> [!NOTE]
> Test files import everything from `@/test/test-utils` instead of directly from `@testing-library/react`. This ensures every test automatically gets the full provider tree without boilerplate.

---

## 4. How a component test executes

Here's the complete chain when a test renders a component:

```
Test file calls:  render(<LoginPage />)
                         │
                         ▼
         renderWithProviders() in test-utils.tsx
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   createWrapper()   RTL render()   jsdom DOM
         │               │               │
         ▼               ▼               ▼
   <QueryClientProvider>               <div id="root">
     <MemoryRouter>                      ← React renders here
       <LoginPage />
       <Toaster />
     </MemoryRouter>
   </QueryClientProvider>
                         │
                         ▼
              React reconciles & commits
              → jsdom DOM is now populated
              → <form>, <input>, <button> etc. exist
                         │
                         ▼
            Test queries the DOM using RTL:
            screen.getByRole('button', { name: 'Sign in' })
            screen.getByLabelText('Email')
                         │
                         ▼
            Test simulates user interactions:
            userEvent.click(button)
            userEvent.type(emailInput, 'test@test.com')
                         │
                         ▼
            Test asserts on resulting DOM:
            expect(screen.getByText('Welcome')).toBeVisible()
            expect(screen.queryByText('Error')).not.toBeInTheDocument()
```

---

## 5. Query types cheat sheet

RTL provides multiple query variants. Understanding the naming convention is key:

| Prefix | Returns | Throws on missing? | Async? | Use case |
|---|---|---|---|---|
| `getBy*` | Element | Yes | No | Element must exist right now |
| `queryBy*` | Element \| `null` | No | No | Assert element does NOT exist |
| `findBy*` | Promise\<Element\> | Yes (after timeout) | Yes | Element appears after async operation |
| `getAllBy*` | Element[] | Yes | No | Multiple elements expected |
| `queryAllBy*` | Element[] (empty OK) | No | No | Check count of elements |
| `findAllBy*` | Promise\<Element[]\> | Yes | Yes | Multiple elements after async |

### Query selectors, best first

| Selector | Example | Accesses |
|---|---|---|
| `ByRole` | `getByRole('button', { name: 'Submit' })` | ARIA role + accessible name |
| `ByLabelText` | `getByLabelText('Email')` | `<label>` association |
| `ByPlaceholderText` | `getByPlaceholderText('Search...')` | Placeholder attribute |
| `ByText` | `getByText('Welcome back')` | Visible text content |
| `ByDisplayValue` | `getByDisplayValue('current value')` | Current form input value |
| `ByAltText` | `getByAltText('Profile photo')` | Image alt text |
| `ByTitle` | `getByTitle('Close')` | Title attribute |
| `ByTestId` | `getByTestId('custom-element')` | `data-testid` attribute (last resort) |

---

## 6. userEvent against fireEvent

This project uses `@testing-library/user-event` (re-exported from `test-utils.tsx`):

```ts
export { default as userEvent } from '@testing-library/user-event'
```

| Feature | `fireEvent` (built-in) | `userEvent` (external) |
|---|---|---|
| Event dispatch | Single low-level event | Full interaction sequence |
| `click()` | Fires just `click` | Fires `pointerdown` → `mousedown` → `pointerup` → `mouseup` → `click` |
| `type()` | N/A | Fires `keydown` → `keypress` → `input` → `keyup` per character |
| Focus management | Manual | Automatic (clicking focuses the element) |
| Realism | Low | High, matches real browser behaviour |

> [!TIP]
> Always prefer `userEvent` over `fireEvent`. It catches bugs that `fireEvent` misses (e.g., a button that works on `click` but is broken on `pointerdown`).

---

## 7. Cleanup

**File**: [`src/test/setup.ts`](../../src/test/setup.ts), line 25

```ts
afterEach(() => {
  cleanup()   // ← RTL's cleanup function
  // ... other resets ...
})
```

`cleanup()` does the following after every test:
1. Unmounts every React component tree that was rendered via `render()`.
2. Removes the container `<div>` from jsdom's `document.body`.
3. Ensures the next test starts with a clean DOM.

Without cleanup, component state, side effects, and DOM nodes from test A would leak into test B.

---

## 8. Integration map

```
                    ┌──────────────────────────────┐
                    │    test-utils.tsx             │
                    │  (single import for tests)    │
                    └──────────┬───────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
   @testing-library/    @testing-library/   @testing-library/
       react                user-event          jest-dom
         │                     │                    │
         ▼                     ▼                    ▼
   render() + queries    userEvent.click()   expect().toBeVisible()
   screen, waitFor       userEvent.type()    expect().toBeInTheDocument()
         │                     │                    │
         └─────────┬───────────┘                    │
                   ▼                                │
            jsdom DOM                               │
           (from Vitest                             │
            environment)                            │
                   │                                │
                   └────────────────────────────────┘
                           Vitest expect()
                         (extended with jest-dom)
```

---

## 9. Where this shows up

**A refactor breaks 20 tests without changing behaviour.** The tests queried by
class name or DOM structure. `getByRole('button', { name: 'Save' })` survives a
markup change; `container.querySelector('.btn-primary')` does not.

**An element "is not in the document" but you can see it in the debug output.**
It renders after an await. `getBy*` throws immediately, `findBy*` waits. That one
prefix is most async test failures.

**A click does nothing.** `fireEvent.click` dispatches one event. A real click
also focuses, and some components only act on focus plus click. `userEvent.click`
fires the whole sequence.

**Two tests pass separately and fail together.** Without the `cleanup()` in
`afterEach`, the first render is still mounted, so `getByText` finds two matches
and throws.

---

Previous: [Vitest](./Vitest.doc.md).
Next: [MSW](./MSW.doc.md), which answers the requests these rendered components fire.
