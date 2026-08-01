# 8. Zustand — crash course + this project

Zustand is a **minimal global store** for React: no built-in providers for the store itself (unlike some Redux setups), small API surface, and optional **middleware** such as **persistence** to `localStorage`. This chapter explains the **Zustand way** of managing state, then **exactly where and why** it appears in this codebase.

For the shorter overview, see [02 — State Management](./02-state-management.md). For how auth interacts with routing and the API layer, see [04 — Authentication, Routing & Access Control](./04-auth-routing-access-control.md).

---

## 8.1 Zustand mental model (speedrun)

### Store creation

You call `create()` with a function that receives `set` (and optionally `get`) and returns the **public state** and **actions** that mutate it:

```ts
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### Subscribing in components

Components use the hook with a **selector** to read only what they need (avoids re-renders when unrelated slices change):

```ts
const count = useStore((s) => s.count);
```

### `persist` middleware

`persist` saves part of the store to a storage backend (here, `localStorage`) so state survives reloads. **`partialize`** limits what is persisted — important so you do not persist secrets or huge objects.

---

## 8.2 What this project stores in Zustand (and what it does not)

**File:** [`client/src/store/auth.ts`](../src/store/auth.ts)

There is **one** Zustand store. It holds:

- **`isAuthenticated`** — a **client-side boolean** used for fast routing and hydration.
- **`setAuthenticated`** — sets the flag (default `true` when called with no args).
- **`clearAuth`** — resets the flag to `false`.

It **does not** store:

- JWTs or cookies (auth uses **HTTP-only cookies**; see [04](./04-auth-routing-access-control.md)).
- User profile, email, roles list, or **capabilities** — those come from **`useAuthMe`** (React Query + `/api/auth/me`).

That split is intentional: **server-owned identity and permissions** stay in React Query; **one small UI/routing flag** stays in Zustand.

---

## 8.3 Why Zustand here (cause)

1. **First paint / hard refresh:** Before `useAuthMe` resolves, something must decide whether to show a loading skeleton vs redirect. The persisted `isAuthenticated` gives a **hint** that the user recently logged in on this browser, while `ProtectedRoute` still **re-validates** against the server.
2. **Tiny surface area:** The app does not need Redux or a large global tree. One store with three fields fits Zustand well.
3. **Imperative access outside React:** The Axios response interceptor can call `useAuthStore.getState().clearAuth()` when refresh fails — no hook required ([`client/src/api/client.ts`](../src/api/client.ts)).

---

## 8.4 Where each action is used

| Action | Where | Purpose |
|--------|--------|---------|
| `setAuthenticated` | [`AuthPage`](../src/pages/AuthPage.tsx) after login | Mark session as active client-side |
| `setAuthenticated` | [`ProtectedRoute`](../src/components/ProtectedRoute.tsx) when `authMe.data` exists | Keep Zustand aligned with server truth |
| `clearAuth` | [`AppShell`](../src/components/AppShell.tsx) logout `onSettled` | Reset flag after logout |
| `clearAuth` | [`client.ts`](../src/api/client.ts) when 401 refresh fails | Force logged-out UI and redirect |

---

## 8.5 Persistence details

**Storage key:** `rbac-auth-session`  
**Persisted fields:** Only `isAuthenticated` via `partialize` — not actions, not user data.

If you clear site data or use another browser, the flag is gone; the user must sign in again. That is correct: the **real** session is the cookie, not localStorage.

---

## 8.6 When you would add more Zustand (guidance)

Reach for Zustand when state is:

- **Global** (many distant components need it),
- **Client-only** (not authoritative on the server),
- **Not a natural fit** for URL or React Query (e.g. a global modal queue, sidebar collapsed preference).

Do **not** move list data or RBAC capabilities into Zustand — that duplicates the server and fights React Query’s cache and invalidation model.

---

## 8.7 Related docs

- [01 — Architecture Overview §1.3](./01-architecture-overview.md#13-design-principles) — server state vs client state
- [07 — React Query](./07-react-query.md) — where profile and capabilities live
- [10 — Axios and interceptors](./10-axios-and-interceptors.md) — `clearAuth` on auth failure
