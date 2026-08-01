# Client interview answers (prepared responses)

> Answers for [11_client_interview_questions.md](./11_client_interview_questions.md).  
> Practice the **short answer** out loud first, then expand with **deep answer** if the interviewer probes.

---

## 1. Architecture and folder boundaries

**Short answer (30–60 sec)**  
Pages are route entrypoints: they own React Query, mutations, and forms. `features/<domain>/components` hold UI pieces for one domain, exported through a barrel. `api/` is transport only. Shared cross-cutting UI is in `components/shared` and `components/layout`. Pages import features via `@/features/users`, not deep paths.

**Deep answer (2–3 min)**  
- **`pages/`** — e.g. `UsersPage.tsx`: wires `useQuery`, `useMutation`, `useForm`, passes props into feature components, renders `confirmDialog`.
- **`features/<name>/components/`** — presentational or small self-contained blocks (`UsersTable`, `CreateUserForm`).
- **`features/<name>/index.ts`** — public API for that feature.
- **`components/ui/`** — design primitives (Button, Panel, Field, dialogs).
- **`components/shared/`** — `AccessDenied`, `AsyncQueryPanel` (no domain knowledge).
- **`components/layout/`** — `AppShell`, sidebar, topbar, `navVisibility.ts`.
- **`api/`** — axios client, services, OpenAPI-derived types; no React.

Import rules: features do not import other features; pages do not import `@/features/users/components/UsersTable` directly. See `09_component_delegation_refactor.md`.

**Tradeoffs / pitfalls**  
- Pitfall: putting `useMutation` inside every leaf component — harder to test and reuse; this repo keeps orchestration in pages by design.
- Tradeoff: pages are still ~150–190 lines — next step is `features/*/hooks/`.

**Files:** `src/pages/UsersPage.tsx`, `src/features/users/index.ts`, `src/App.tsx`

---

## 2. Server state: TanStack Query vs Zustand

**Short answer**  
React Query caches **server data** (lists, `/me`, pagination). Zustand only stores a **persisted boolean** `isAuthenticated` for routing hints. Server truth always comes from the API and query cache.

**Deep answer**  
- **React Query** (`main.tsx`): default `staleTime: 20_000`, `retry: 1`, `retryOnMount: false` on queries to avoid remount refetch loops on failed `auth/me`.
- **Query keys** in `constants.ts`: `queryKeys.users(page)`, `queryKeys.authMe`, etc.
- **Invalidation** after mutations: e.g. `queryClient.invalidateQueries({ queryKey: ['users'] })` or `queryKeys.authMe` when roles change.
- **Zustand** (`store/auth.ts`): `persist` middleware, `partialize` to only persist `isAuthenticated`; `setAuthenticated` / `clearAuth` used from login/logout and interceptor.

**Tradeoffs / pitfalls**  
- Pitfall: duplicating user profile in Zustand — this app avoids that; profile is `useAuthMe()` data.
- Pitfall: invalidating too broadly causes refetch storms; too narrow leaves stale UI.

**Files:** `src/main.tsx`, `src/constants.ts`, `src/store/auth.ts`, `src/hooks/useAuth.ts`

---

## 3. Authentication and session handling

**Short answer**  
Login posts credentials with cookies enabled. The browser stores HTTP-only session cookies. Axios intercepts 401s, calls `/api/auth/refresh` once (deduped), retries the request, or clears auth and sends the user to `/login`. `ProtectedRoute` loads `/api/auth/me` before showing the app shell.

**Deep answer**  
1. **Login** (`AuthPage.tsx`): `authApi.login` → `setAuthenticated()` → `fetchQuery` on `queryKeys.authMe` → navigate dashboard.
2. **Axios** (`api/client.ts`): `withCredentials: true`; success responses unwrap `{ success, data }` envelope.
3. **401 handler:** skip login/refresh URLs; set `_retry` on config; `await refreshSession()`; retry `api(originalRequest)`; on failure `clearAuth()` + `window.location.assign('/login')`.
4. **Refresh dedup:** `refreshPromise ??= axios.get('/api/auth/refresh')` so parallel 401s share one refresh.
5. **ProtectedRoute:** `useAuthMe()`; on data → `setAuthenticated()`; 401 `ApiClientError` → `clearAuth()` + redirect login; other errors → `QueryErrorState` with retry; loading → skeleton.

**Tradeoffs / pitfalls**  
- Pitfall: storing JWT in `localStorage` — XSS exposure; this app correctly uses cookies.
- Pitfall: infinite refresh loop — mitigated by `_retry` flag and excluding auth endpoints.
- `ProtectedRoute` uses full page redirect on interceptor failure vs React Router only — know both paths exist.

**Files:** `src/api/client.ts`, `src/pages/AuthPage.tsx`, `src/components/ProtectedRoute.tsx`

---

## 4. RBAC and capabilities in the UI

**Short answer**  
After login, `/api/auth/me` returns roles and a `capabilities` array. `useCapabilities()` builds a `Set` and exposes `can('users.create')`. Components conditionally render panels and buttons. The **backend still enforces** every mutation; the UI is UX only.

**Deep answer**  
- `useAuthMe` — query key `queryKeys.authMe`, `queryFn: authApi.me`.
- `useCapabilities` — `useMemo` → `Set` of capability strings; `can(capability)` checks membership.
- **Pages** — e.g. `{can('users.create') ? <CreateUserForm /> : null}`.
- **Nav** — `navVisibility.ts`: `visibleNavItem` filters `navItems` from `constants.ts` by optional `capability` on each item; session routes use nested `children`.
- **Limitation:** A malicious client can call APIs directly; missing `can()` only hides buttons.

**Tradeoffs / pitfalls**  
- Must say in interviews: **authorization is server-side**; client RBAC prevents mistakes and clutter, not attacks.
- Capabilities can stale until `authMe` refetch — role assign revokes invalidate `authMe` intentionally.

**Files:** `src/hooks/useAuth.ts`, `src/constants.ts` (`navItems`), `src/components/layout/navVisibility.ts`, `src/pages/UsersPage.tsx`

---

## 5. OpenAPI and TypeScript types

**Short answer**  
Backend publishes OpenAPI JSON. We run `pnpm generate:types` to regenerate `api/schema.ts`, then re-export ergonomic aliases from `api/types.ts`. Services use those types for request/response shapes.

**Deep answer**  
- Script: `"generate:types": "openapi-typescript ../server/openapi/openapi.json -o src/api/schema.ts"`.
- `api/types.ts` — `type X = Schemas['X']` pattern from `components['schemas']`.
- `api/services.ts` — grouped APIs (`usersApi`, `authApi`, …) calling `request<T>()`.
- When API changes: regenerate schema, fix compile errors in services/pages, adjust Zod schemas in `validation/schemas.ts` if input shapes changed.

**Tradeoffs / pitfalls**  
- Generated file is huge — never hand-edit `schema.ts`.
- Runtime validation still needs Zod for forms; OpenAPI types alone do not validate at runtime on the client.

**Files:** `client/package.json`, `src/api/schema.ts`, `src/api/types.ts`, `src/api/services.ts`

---

## 6. Forms and validation

**Short answer**  
Zod schemas in `validation/schemas.ts` define rules. `zodResolver` connects them to react-hook-form. `Field` / `SelectField` show `formState.errors.*.message`. Submit runs `handleSubmit` only if valid.

**Deep answer (create user example)**  
1. `createUserSchema` in `validation/schemas.ts` (extends register fields + `roleName`).
2. `UsersPage`: `useForm<CreateUserFormValues>({ resolver: zodResolver(createUserSchema), mode: 'onBlur' })`.
3. `CreateUserForm`: `form.handleSubmit(onSubmit)` on `<form>`, fields spread `{...form.register('fullname')}`.
4. On success: `createUser.mutate(data)` → toast → `createUserForm.reset(...)`.

**Tradeoffs / pitfalls**  
- `mode: 'onBlur'` vs `onChange` — trade validation noise vs early feedback.
- Server validation errors (400 with details) are not uniformly mapped to fields in every form — mostly toast via `ApiClientError.message`.

**Files:** `src/validation/schemas.ts`, `src/features/users/components/CreateUserForm.tsx`, `src/pages/UsersPage.tsx`

---

## 7. Loading, errors, and rate limits

**Short answer**  
Lists use `AsyncQueryPanel`: skeleton while loading, `QueryErrorState` on error with retry, `EmptyState` when no data, children when success. Axios shows a toast on 429 with optional `Retry-After`. Mutations use `toast.error` on failure.

**Deep answer**  
- **`AsyncQueryPanel`** (`components/shared/AsyncQueryPanel.tsx`) — props: `isLoading`, `isError`, `error`, `hasData`, labels, `onRetry`.
- Used by `UsersTable`, `MigrationsTable`, `PostsList`, `SessionsQueryResult`, etc.
- **`QueryErrorState`** — uses `getErrorMessage` from `api/client.ts`.
- **401** — refresh path (not shown as panel error on protected routes if refresh succeeds).
- **429** — interceptor: `toast.warning` with server message + retry-after header text; still rejects with `ApiClientError`.
- **Audit logs** — special case: manual “Fetch” button, `enabled: fetchEnabled` on query (not using `AsyncQueryPanel` for initial idle state).

**Tradeoffs / pitfalls**  
- Do not use `AsyncQueryPanel` when UX is “click to load” without a query yet (audit logs idle state).
- Global 429 toast vs inline error — global can be missed; know your choice.

**Files:** `src/components/shared/AsyncQueryPanel.tsx`, `src/components/QueryErrorState.tsx`, `src/api/client.ts`, `src/features/audit-logs/components/AuditLogsPanel.tsx`

---

## 8. Mutation lifecycle (Users — create user)

**Short answer**  
Submit → RHF validation → `createUser.mutate(data)` → `usersApi.create` → interceptor unwraps response → `onSuccess` toast + form reset + `invalidateQueries` for `['users']` → React Query refetches list → `UsersTable` re-renders.

**Deep answer**  
1. User submits `CreateUserForm` → `createUserForm.handleSubmit` → `onSubmit` in page passes `createUser.mutate(data)`.
2. `useMutation({ mutationFn: usersApi.create, onSuccess, onError })`.
3. `usersApi.create` → POST `/api/users` via `request()`.
4. Success: `toast.success('User created')`, `createUserForm.reset({ fullname: '', email: '', password: '', roleName: 'user' })`, `invalidateUsers()` → `queryKey: ['users']`.
5. Active `useQuery` on `queryKeys.users(page)` refetches; `placeholderData: keepPreviousData` avoids pagination flicker.
6. Error: `toast.error(error.message)` from `ApiClientError`.

**Why invalidate `authMe` after role assign/revoke?**  
Current user’s capabilities may change if you mutated your own roles (or for consistency after role changes); `invalidateAuthMe` ensures `can()` and nav stay accurate.

**Files:** `src/pages/UsersPage.tsx`, `src/api/services.ts`, `src/features/users/components/CreateUserForm.tsx`, `src/features/users/components/UsersTable.tsx`

---

## 9. Recent refactor: component delegation

**Short answer**  
Large pages mixed JSX, tables, and forms. We extracted UI into `features/*/components` and shared `AccessDenied` / `AsyncQueryPanel`, moved `AppShell` into `layout/`, added `@/` alias. Pages still own all hooks and mutations — **behavior unchanged**.

**Deep answer**  
- **Moved:** form markup, tables, cards, session list UI, auth hero/form, dashboard stats panel.
- **Stayed in pages:** `useQuery`, `useMutation`, `useForm`, `confirmDialog`, page-level state (`editingUser`, `page`, `fetchEnabled`).
- **Not changed:** API layer, Zod schemas, query keys, toast text, capability checks.
- **Add new screen:** `features/foo/components/*` → `features/foo/index.ts` → `pages/FooPage.tsx` → route in `AppShell`.

Documented in `09_component_delegation_refactor.md` and `09_component_delegation_file_map.md`.

**Tradeoffs / pitfalls**  
- Refactor without tests is risky — you relied on typecheck + manual smoke; mention you’d add tests before another large move.

**Files:** `client/plan_readme/09_*.md`, `src/components/layout/`, `src/features/`

---

## 10. Production readiness

**Short answer**  
First: automated tests (unit + MSW integration for auth and one CRUD page). Second: decouple `api/client.ts` from toasts/store for testability. Third: extract feature hooks to slim pages. Then E2E smoke and a11y on shell/forms.

**Deep answer — prioritized backlog**  

| Priority | Item | Rationale |
|----------|------|-----------|
| P0 | Vitest + RTL + MSW | No safety net today; `07_frontend_testing_guide.md` already outlines approach |
| P0 | Test refresh interceptor | Race on concurrent 401, single retry, redirect on failure |
| P1 | `features/*/hooks/useXPage.ts` | Shrink pages, easier to test mutations in isolation |
| P1 | Inject side effects in axios layer | Replace direct `toast` / `useAuthStore` in interceptor |
| P2 | Playwright smoke | Login → users list → create → logout |
| P2 | a11y on `AppSidebar` accordion, tables, dialogs | Keyboard and screen reader |
| P3 | Storybook for `components/ui` | Optional for team reuse |

**Testing refresh without clicking**  
- Unit-test `refreshSession` behavior with mocked axios: two parallel 401s → one refresh call.
- Or MSW: first GET returns 401, refresh returns 200, retry returns 200.

**Tradeoffs / pitfalls**  
- Do not say “ship then add tests” for IAM/admin without pushback — interviewers want risk awareness.
- Over-testing implementation details (e.g. exact class names) vs behavior — prefer user-visible outcomes.

**Files:** `src/api/client.ts`, `client/plan_readme/07_frontend_testing_guide.md`, `client/package.json` (no test script yet)

---

## Quick reference card (day before interview)

| Topic | One line |
|-------|----------|
| Auth | Cookies + refresh interceptor + `ProtectedRoute` /me |
| RBAC | `useCapabilities().can()` — UI only |
| Data | React Query cache + Zustand auth flag |
| Types | OpenAPI → `schema.ts` → `types.ts` |
| Forms | Zod + RHF + `validation/schemas.ts` |
| Structure | pages orchestrate, features render |
| Gap | No tests yet — P0 fix |

Good luck — speak in **tradeoffs**, not buzzwords.
