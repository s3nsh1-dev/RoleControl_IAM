# 7. TanStack React Query — crash course + this project

This chapter is a **speedrun** of TanStack Query (v5) for readers who are new to it, then a **map of how it is wired** in this RBAC console. For the shorter overview inside the broader state-management story, see [02 — State Management](./02-state-management.md).

---

## 7.1 What problem React Query solves

Server data (users, roles, posts, your profile) **lives on the API**. The browser only holds a **cache**: a copy that can go stale. Without a library, teams usually write `useEffect` + `fetch` + `useState` for loading and errors, then manually refetch after every mutation. That gets brittle (double fetches, stale UI, easy to forget invalidation).

**React Query** treats the server as the **source of truth** and gives you:

- A **cache** keyed by `queryKey`
- **Automatic refetch** when data is stale or when you **invalidate** keys after mutations
- **Loading / error / success** states per query
- **Deduping** concurrent requests for the same key

You still call your HTTP layer (`services` → `request`); React Query only orchestrates **when** to call it and **where** to put the result.

---

## 7.2 Core concepts (speedrun)

### Provider and client

The app creates one `QueryClient` and wraps the tree in `QueryClientProvider`. Global defaults apply to all queries unless overridden per hook.

In this project: [`client/src/main.tsx`](../src/main.tsx).

### `useQuery` — read (GET-style) data

- **`queryKey`**: A serializable array that **identifies** this cache entry. If the key changes (e.g. page number), React Query treats it as a different cache slot.
- **`queryFn`**: Async function that returns the data. Here it almost always delegates to `*Api.list` / `*Api.me` in [`client/src/api/services.ts`](../src/api/services.ts).
- **`staleTime`**: How long data is considered “fresh.” While fresh, React Query may serve cache without refetching on mount (depending on other options).
- **`placeholderData: keepPreviousData`**: When the key changes (pagination), show **previous** data until the new request finishes — avoids flashing empty tables.

### `useMutation` — write (POST/PUT/DELETE) operations

- **`mutationFn`**: The function that performs the write (e.g. `usersApi.create`).
- **`onSuccess` / `onError`**: Side effects — toasts, form resets, and critically **`queryClient.invalidateQueries`** so lists refetch and stay in sync with the server.

### `useQueryClient`

Gives access to the shared client instance so you can `invalidateQueries`, `fetchQuery`, or `clear()` from mutations or layout components.

### Invalidation pattern (critical in this codebase)

After a successful mutation, we **invalidate** the relevant query key prefix so React Query refetches:

```ts
queryClient.invalidateQueries({ queryKey: ["users"] });
```

Keys are centralized in [`client/src/constants.ts`](../src/constants.ts) as `queryKeys` to avoid typos and keep invalidation consistent.

---

## 7.3 How this project configures React Query

**File:** [`client/src/main.tsx`](../src/main.tsx)

- **`retry: 1`** — Failed queries retry once (transient network blips).
- **`staleTime: 20_000`** — Data is treated as fresh for 20 seconds; reduces noisy refetches when navigating between pages.

Individual queries can override these (see `useAuthMe` below).

---

## 7.4 Where queries and mutations live

| Area | Role |
|------|------|
| [`client/src/constants.ts`](../src/constants.ts) | `queryKeys` — canonical cache keys |
| [`client/src/hooks/useAuth.ts`](../src/hooks/useAuth.ts) | `useAuthMe` — session / capabilities source query |
| [`client/src/pages/*Page.tsx`](../src/pages/) | List `useQuery` + CRUD `useMutation` per feature |
| [`client/src/pages/AuthPage.tsx`](../src/pages/AuthPage.tsx) | Login/register mutations; eager `fetchQuery` for `authMe` after login |
| [`client/src/components/AppShell.tsx`](../src/components/AppShell.tsx) | Logout mutation; `queryClient.clear()` on logout |
| [`client/src/pages/DashboardPage.tsx`](../src/pages/DashboardPage.tsx) | Multiple parallel `useQuery` calls for dashboard counts |

**Representative list + mutation pattern:** [`UsersPage.tsx`](../src/pages/UsersPage.tsx) — `useQuery` with `queryKeys.users(page)` and `placeholderData: keepPreviousData`; mutations call `invalidateUsers()` and sometimes `invalidateAuthMe()` when the current user’s roles/capabilities could change.

---

## 7.5 Special cases worth understanding

### Session query: `useAuthMe` uses `retry: false`

**File:** [`client/src/hooks/useAuth.ts`](../src/hooks/useAuth.ts)

If `/api/auth/me` fails (no session), you do **not** want React Query to keep retrying — that would delay showing the login redirect and feel broken. `retry: false` makes failure immediate so [`ProtectedRoute`](../src/components/ProtectedRoute.tsx) can send the user to `/login`.

### After login: eager fetch of `authMe`

**File:** [`client/src/pages/AuthPage.tsx`](../src/pages/AuthPage.tsx)

On login success, the app sets the Zustand auth flag, then **`fetchQuery`** for `queryKeys.authMe` so the cache is warm before navigating to `/dashboard`. That way protected layout and capability checks have data without waiting for a second mount cycle.

### Logout: wipe the entire cache

**File:** [`client/src/components/AppShell.tsx`](../src/components/AppShell.tsx)

`queryClient.clear()` removes **all** cached queries so no user A data flashes after user B logs in on the same browser profile.

---

## 7.6 Why React Query here (cause and role)

- **RBAC data is server-owned.** Lists and detail views must reflect PostgreSQL-backed truth; caching + invalidation matches that model.
- **Pagination** is everywhere; `keepPreviousData` keeps the UX stable.
- **Mutations** (create user, assign role, delete permission) must **invalidate** the right keys; the pattern is repeated on every page for consistency.
- **Session** is also server-owned (`/auth/me`); React Query holds profile and `capabilities` while Zustand only holds a small client flag (see [08 — Zustand](./08-zustand.md)).

---

## 7.7 Related docs

- [02 — State Management](./02-state-management.md) — three-layer state model
- [03 — Network Layer](./03-network-layer.md) — what `queryFn` actually calls
- [04 — Authentication, Routing & Access Control](./04-auth-routing-access-control.md) — `authMe` and protected routes
- [11 — Separation of Concerns](./11-separation-of-concerns.md) — why pages own queries, not raw `fetch` in UI primitives
