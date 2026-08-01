# 6. Code Patterns, Strengths & Weaknesses

## 6.1 Established Code Patterns

These are the patterns that a new developer **must** follow to maintain codebase consistency.

### Pattern 1: Never fetch data with useEffect
```
❌  useEffect(() => { fetch("/api/users").then(setUsers) }, [])
✅  const users = useQuery({ queryKey: queryKeys.users(page), queryFn: ... })
```
All data fetching goes through React Query. This gives you caching, retries, loading states, and background refetching for free.

### Pattern 2: Never call Axios directly in components
```
❌  axios.get("/api/users")
✅  usersApi.list({ page: 1, pageSize: 20 })
```
All API calls are defined in `src/api/services.ts`. Components import the service factories.

### Pattern 3: Invalidate queries after mutations
```ts
useMutation({
  mutationFn: usersApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  },
});
```
Never try to manually update the local cache. Always let React Query refetch from the server after a write operation.

### Pattern 4: Use capabilities, not roles
```
❌  {user.role === "admin" && <Button>Delete</Button>}
✅  {can("users.delete") ? <Button>Delete</Button> : null}
```

### Pattern 5: Confirmation before destructive actions
Every delete/revoke operation must go through `useConfirmAction`:
```tsx
const { confirm, confirmDialog } = useConfirmAction();

onClick={() => confirm({
  title: "Delete user",
  description: `Delete ${user.email}?`,
  confirmLabel: "Delete",
  onConfirm: () => deleteUser.mutate(user.id),
})}

// At the bottom of the return JSX:
{confirmDialog}
```

### Pattern 6: Toast notifications for feedback
```ts
onSuccess: () => toast.success("User created"),
onError: (error) => toast.error(error.message),
```
User-facing feedback goes through Sonner toasts. Never use `alert()` or `console.log()`.

### Pattern 7: Use the UI primitives
```
❌  <button className="button button-primary">Submit</button>
✅  <Button variant="primary">Submit</Button>
```
Always use the components from `src/components/ui.tsx`.

### Pattern 8: Conditional rendering with ternary + null
```
❌  {can("users.create") && <Panel>...</Panel>}
✅  {can("users.create") ? <Panel>...</Panel> : null}
```
The codebase consistently uses the explicit ternary pattern rather than short-circuit (`&&`) evaluation, which can accidentally render `0` or `""` in certain edge cases.

---

## 6.2 Strengths

### 1. Clean Separation of Concerns
The codebase has zero cross-contamination between layers. The `api/` directory knows nothing about React. The `components/ui.tsx` file knows nothing about APIs. Pages wire everything together.

### 2. Robust Silent Token Refresh
The Axios interceptor implementation is production-grade:
- Deduplicates concurrent refresh requests via shared promise.
- Prevents infinite retry loops via the `_retry` flag.
- Excludes auth endpoints from refresh logic (avoids refreshing during login).

### 3. Type-Safe API Contract
The `openapi-typescript` pipeline eliminates an entire class of bugs. If the backend renames a field from `fullname` to `full_name`, the frontend build will fail immediately rather than silently rendering `undefined`.

### 4. Scalable RBAC Implementation
The `useCapabilities` hook with a memoized `Set` is both performant and extensible. Adding a new capability to the system requires zero frontend changes beyond using `can("new.capability")` where needed.

### 5. Consistent Page Structure
Every page follows the exact same template (hooks → queries → mutations → JSX), making it trivial for a new developer to find where things are.

### 6. Theme System via CSS Variables
Dark mode works by swapping CSS variables on `<html>`. No JavaScript logic is needed in individual components to support theming.

---

## 6.3 Weaknesses & Improvement Areas

### 1. Monolithic `ui.tsx`
**Problem:** 8 components in a single 177-line file. As the project grows, this becomes harder to navigate and leads to merge conflicts.

**Recommended fix:** Split into `src/components/ui/Button.tsx`, `src/components/ui/Panel.tsx`, etc., with a barrel `src/components/ui/index.ts`.

### 2. Underutilized react-hook-form
**Problem:** `react-hook-form` and `zod` are both installed in `package.json` but forms use raw `useState` for each field. This leads to boilerplate (`setFullname`, `setEmail`, `setPassword`) and no structured validation.

**Recommended fix:** Migrate forms to `useForm()` with `zodResolver()` for schema-based validation.

### 3. Inline `window.prompt()` for Edits
**Problem:** Editing a user's name or a post's title uses `window.prompt()`, which blocks the main thread, cannot be styled, and provides no validation.

**Recommended fix:** Replace with inline edit forms or modal edit dialogs using the existing `ConfirmDialog` pattern.

### 4. No Error Boundaries
**Problem:** If a component throws a rendering error, the entire app crashes to a white screen.

**Recommended fix:** Add React Error Boundaries around route-level components.

### 5. No Automated Tests
**Problem:** No test runner (Vitest), no component testing (React Testing Library), no E2E testing (Playwright/Cypress) is configured.

**Recommended fix:** Add Vitest + React Testing Library. Priority test targets: the Axios interceptor logic, the `useCapabilities` hook, and the `ProtectedRoute` guard.

### 6. Pagination State Resets on Navigation
**Problem:** When a user navigates away from `/users` (page 3) and returns, they start at page 1 because `useState(1)` reinitializes.

**Recommended fix:** Sync pagination state with URL search params (`?page=3`) so it survives navigation.

---

## 6.4 Glossary of Frontend Terminologies Used

| Term | Meaning in this codebase |
|---|---|
| **SPA** | Single Page Application — one HTML file, all routing happens in JS |
| **CSR** | Client-Side Rendering — browser renders the UI, not the server |
| **Server State** | Data owned by the backend, cached temporarily on the frontend |
| **Client State** | Data that exists only on the frontend (auth flags, theme preference) |
| **Query Key** | A unique identifier for cached data in React Query |
| **Mutation** | A write operation (POST, PUT, DELETE) that changes server state |
| **Invalidation** | Telling React Query to discard cached data and refetch from the server |
| **Interceptor** | Middleware that runs before/after every HTTP request/response |
| **Silent Refresh** | Automatically renewing an expired token without user interaction |
| **Capability** | A specific permission string (e.g., `users.create`) granted to a user |
| **Feature Flag** | A runtime toggle that shows/hides UI features based on conditions |
| **Presentation Component** | A UI component with no business logic (only props → HTML) |
| **Container Component** | A component that fetches data, manages state, and orchestrates UI |
| **Envelope** | A wrapper object around API responses (`{ success, message, data }`) |
| **Hydration** | Restoring persisted state (e.g., from localStorage) on app startup |
| **Prop Drilling** | Passing data through many component layers (avoided via Zustand) |
| **Stale Time** | Duration after which cached data is considered outdated |
| **Optimistic Update** | Updating the UI before the server confirms (not used here) |
| **Barrel Export** | An `index.ts` that re-exports from multiple files for cleaner imports |
