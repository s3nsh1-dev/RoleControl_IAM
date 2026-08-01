# 3. Network Layer & API Client

## 3.1 Why Axios Over Native Fetch

The native `fetch()` API is sufficient for simple GET requests, but this application requires:

1. **Request/Response interceptors** — middleware that runs on every request/response globally.
2. **Automatic JSON handling** — Axios stringifies request bodies and parses responses without manual `JSON.parse`.
3. **The `withCredentials` flag** — a one-line configuration to attach HTTP-only cookies on every cross-origin request.
4. **Typed error objects** — Axios provides structured `AxiosError` objects with `.response.status`, `.response.data`, and headers.

---

## 3.2 The Axios Instance

**File:** `src/api/client.ts`

The application creates a single shared Axios instance:
```ts
const api = axios.create({
  withCredentials: true,      // attach cookies (session tokens) on every request
  headers: {
    "Content-Type": "application/json",
  },
});
```

Every API call in the app flows through this instance, ensuring consistent cookie handling and header configuration.

---

## 3.3 Response Envelope Unwrapping

The backend wraps all successful responses in a standard envelope:
```json
{
  "success": true,
  "message": "Users retrieved",
  "data": { "users": [...], "pagination": {...} },
  "timestamp": "2026-05-03T12:00:00Z"
}
```

The response interceptor **automatically strips this envelope**, so components receive the inner `data` directly:
```ts
api.interceptors.response.use(
  (response) => {
    const envelope = response.data as SuccessEnvelope<unknown>;
    if (envelope?.success === true) {
      return envelope.data;  // components get { users: [...], pagination: {...} }
    }
    return response.data;
  },
  // ... error handler
);
```

This means page components never need to write `response.data.data.users` — they simply receive `{ users, pagination }`.

---

## 3.4 The Silent Token Refresh (401 Interceptor)

This is the most critical piece of the network layer. The flow:

```
1. Component calls usersApi.list()
2. Backend returns 401 (access token expired)
3. Interceptor catches the 401
4. Interceptor calls GET /api/auth/refresh (to get a new token via refresh cookie)
5. If refresh succeeds: interceptor retries the ORIGINAL request transparently
6. If refresh fails: interceptor clears auth state and redirects to /login
```

**Key implementation details:**

```ts
let refreshPromise: Promise<unknown> | null = null;

const refreshSession = () => {
  refreshPromise ??= axios
    .get("/api/auth/refresh", { withCredentials: true })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
};
```

**The `??=` (nullish coalescing assignment)** is critical here. If multiple API calls fail with 401 simultaneously, only ONE refresh request is made. All other calls wait for the same promise. This prevents a "refresh storm" where 10 parallel 401s trigger 10 refresh requests.

**The `_retry` flag** prevents infinite loops:
```ts
if (statusCode === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
  originalRequest._retry = true;  // mark as already retried
  await refreshSession();
  return api(originalRequest);    // retry the original request
}
```

---

## 3.5 Rate Limit Handling (429 Interceptor)

When the backend returns `429 Too Many Requests`, the interceptor displays a user-friendly toast:
```ts
if (statusCode === 429) {
  const suffix = retryAfterText ? ` Try again in ${retryAfterText}s.` : "";
  toast.warning(`${error.response?.data?.message ?? "Too many requests."}${suffix}`);
}
```

It reads the `Retry-After` header from the response to tell the user exactly when they can retry.

---

## 3.6 The ApiClientError Class

All backend errors are normalized into a single error class:
```ts
export class ApiClientError extends Error {
  statusCode: number;
  details?: ApiErrorBody["details"];
  retryAfter?: string;
}
```

This means every `onError` handler in every `useMutation` receives a consistent error shape with `.message`, `.statusCode`, and optionally `.details` (field-level validation errors from the backend).

---

## 3.7 Service Factories

**File:** `src/api/services.ts`

API endpoints are organized into domain-specific factory objects. Components never construct URLs or Axios configs directly.

```ts
export const usersApi = {
  list:   (query: PaginationQuery) => request<{ users: UserListItem[]; pagination: PaginationMeta }>({ method: 'GET',    url: '/api/users', ...paginationParams(query) }),
  create: (data: CreateUserRequest) => request<{ user: UserSummary; role: Role }>({ method: 'POST',   url: '/api/users', data }),
  update: (userId: number, data: UpdateUserRequest) => request<{ user: UserSummary }>({ method: 'PUT',    url: `/api/users/${userId}`, data }),
  remove: (userId: number) => request<{ user: UserSummary }>({ method: 'DELETE', url: `/api/users/${userId}` }),
};
```

**Benefits:**
- If the URL changes from `/api/users` to `/api/v2/users`, you update it in ONE place.
- Every call is strongly typed via generics (`request<T>`), so TypeScript knows the exact shape of the response.
- The `paginationParams` helper standardizes how page/pageSize are sent as query parameters.

---

## 3.8 OpenAPI Spec & Type Generation Pipeline (100% Accuracy)

**File:** `src/api/schema.ts` (auto-generated, DO NOT EDIT)  
**File:** `src/api/types.ts` (human-authored aliases)

One of the most robust features of this architecture is how it achieves **100% frontend-backend contract accuracy** using the OpenAPI specification.

### The Problem with Manual Types
In typical React apps, developers manually write TypeScript interfaces that they *assume* match the backend. If the backend changes a field from `full_name` to `fullname`, the frontend doesn't know until it crashes at runtime.

### The Solution: Generated Schemas
We eliminate manual type creation entirely. The pipeline works as follows:

1. **The Backend Defines the Contract:** The backend generates an `openapi.json` specification documenting every endpoint, query parameter, request body, and response structure.
2. **The Frontend Consumes It:** Running `pnpm run generate:types` invokes `openapi-typescript` to parse that JSON and generate a massive `src/api/schema.ts` file containing every exact type.
3. **Aliasing for Convenience:** `src/api/types.ts` extracts clean aliases from the generated schema so components don't have to write `components['schemas']['User']`:

```ts
// src/api/types.ts
import type { components } from './schema'
type Schemas = components['schemas']

export type UserSummary = Schemas['UserSummary']
export type Role = Schemas['Role']
export type RoleName = Schemas['RoleName']
export type CreateUserRequest = Schemas['CreateUserRequest']
```

### How This Guarantees 100% Accuracy

This type safety is enforced in **`src/api/services.ts`** when calling Axios.

**1. Request Payload Accuracy:**
```ts
create: (data: CreateUserRequest) => request<...>({ method: 'POST', url: '/api/users', data }),
```
By typing the `data` parameter as `CreateUserRequest` (which comes directly from the OpenAPI spec), TypeScript will **refuse to compile** if the frontend tries to send a field the backend doesn't expect, or forgets a required field.

**2. Response Payload Accuracy:**
```ts
list: (query: PaginationQuery) => 
  request<{ users: UserListItem[]; pagination: PaginationMeta }>({ 
    method: 'GET', url: '/api/users', ...paginationParams(query) 
  }),
```
By passing generic types to `request<T>`, the Axios response is strongly typed. When a component calls `usersApi.list()`, it knows exactly what fields will exist on the `users` objects. If the backend renames `fullname` to `fullName` and you regenerate the types, every component trying to render `user.fullname` will instantly show a red squiggly error in VS Code.

**3. Runtime Enum Accuracy:**
`types.ts` also defines runtime enum arrays used by `<SelectField>` dropdowns:
```ts
export const roleNames = ['super-admin', 'admin', 'editor', 'user'] as const satisfies readonly RoleName[];
```
The `satisfies` keyword is magic here. It guarantees that the hardcoded array perfectly matches the `RoleName` union type generated from the backend. If the backend adds a `"moderator"` role, `RoleName` will update, and TypeScript will throw an error telling you to add `"moderator"` to the `roleNames` array.
