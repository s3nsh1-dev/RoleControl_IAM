# 10. Axios and interceptors — crash course + this project

Axios is an HTTP client with instances, defaults, and **interceptors**: hooks that run on every request or response. This chapter summarizes how that works in general, then walks through **`client/src/api/client.ts`**, which every API call flows through via [`request`](../src/api/client.ts) and [`services.ts`](../src/api/services.ts).

For the broader network-layer narrative (services, errors, typing), see [03 — Network Layer](./03-network-layer.md).

---

## 10.1 Axios basics (speedrun)

- **`axios.create(config)`** returns an instance with shared defaults (`baseURL` is optional here; paths are absolute under `/api/...`).
- **`withCredentials: true`** sends **cookies** on cross-origin or same-site requests as allowed by the browser — required for this app’s **HTTP-only cookie** session.
- **Interceptors:**
  - **Request:** mutate headers, attach tokens (not used for JWT-in-header here — cookies are automatic).
  - **Response:** normalize successes, handle errors globally.

This project uses a **response** interceptor only (no request interceptor).

---

## 10.2 Success path: envelope unwrapping

The backend wraps many JSON bodies in a **success envelope**:

```json
{ "success": true, "message": "...", "data": { ... }, "timestamp": "..." }
```

**File:** [`client/src/api/client.ts`](../src/api/client.ts)

The interceptor checks `envelope.success === true` and returns **`envelope.data`** to callers. That means `services` and React Query `queryFn` functions see **only the inner payload**, not the wrapper — cleaner typing and less repetitive `.data` access in every caller.

If the shape is not that envelope, the interceptor falls back to `response.data` as-is.

---

## 10.3 Error path: 401, refresh, retry

When the access cookie is expired but a refresh cookie exists, the API may respond **401** to protected routes. The app tries to **recover transparently**:

1. If status is **401**, the request is **not** already a retry, and the URL is **not** `/api/auth/login` or `/api/auth/refresh`, the interceptor sets `_retry` on the config.
2. **`refreshSession()`** runs. It uses **plain `axios.get`** to `/api/auth/refresh` — **not** the `api` instance — so the refresh call does not recurse through the same interceptor logic in a bad loop.
3. **`refreshPromise`** is shared (single-flight): concurrent 401s await one refresh.
4. On success, the interceptor **replays** the original request with `api(originalRequest)`.
5. On failure, it calls **`useAuthStore.getState().clearAuth()`** and **`window.location.assign("/login")`** — a full navigation so all client state is left behind consistently.

Auth endpoints are excluded from this loop so a failed login does not trigger refresh.

---

## 10.4 Error path: 429 rate limiting

On **429**, the interceptor shows a **Sonner** toast with the server message and optional **`Retry-After`** header text so the user knows when to retry. It still rejects afterward so callers can handle if needed.

---

## 10.5 Normalized errors: `ApiClientError`

Non-2xx responses are turned into **`ApiClientError`** instances with:

- **`message`** — from API body or Axios
- **`statusCode`**
- **`details`** — optional field-level validation info from the backend
- **`retryAfter`** — when applicable

That keeps **`useMutation` `onError`** handlers simple: `toast.error(error.message)` works consistently across pages.

---

## 10.6 Public API: `request` and `getErrorMessage`

**`request<T>(config)`** is the typed entry point used throughout [`services.ts`](../src/api/services.ts). It uses the configured `api` instance, so **all** service methods get envelope unwrapping and interceptors.

**`getErrorMessage`** is a small helper for unknown errors in catch blocks.

---

## 10.7 Why this shape (cause and where)

| Concern | Handled in |
|---------|------------|
| Cookie session | `withCredentials`, backend `Set-Cookie` |
| Consistent success shape | Response interceptor unwrap |
| Silent refresh | 401 branch + `refreshSession` |
| Logged-out recovery | `clearAuth` + redirect |
| UX for throttling | 429 toast |
| Predictable errors for UI | `ApiClientError` |

Network **URLs and verbs** stay in `services.ts`; **transport policy** stays in `client.ts`. That separation is part of [11 — Separation of Concerns](./11-separation-of-concerns.md).

---

## 10.8 Related docs

- [03 — Network Layer](./03-network-layer.md)
- [04 — Authentication](./04-auth-routing-access-control.md)
- [08 — Zustand](./08-zustand.md) — `clearAuth` from the interceptor
- [07 — React Query](./07-react-query.md) — mutations consuming `ApiClientError`
