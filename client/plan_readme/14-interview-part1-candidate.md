# 14. Interview simulation — Part 1: you (the candidate)

*Read this in the first person. This is how you might present the project after putting it on your resume.*

---

## How I use this project on my resume

**One line I might use:**  
*RoleControl IAM — Express and PostgreSQL on the API side, React SPA on the client, OpenAPI-driven TypeScript, cookie-based sessions with refresh, Redis-backed rate limiting, and automated API tests.*

**Bullets I might add (tune to what you actually did):**

- Designed RBAC flows: users, roles, permissions, assignments, and capability checks — not hard-coded “if admin” checks in the UI.
- Exposed a documented REST API (OpenAPI + Swagger UI) and generated the client types from the same contract.
- Implemented layered rate limiting and structured API errors; client normalizes errors and handles 401 refresh and 429 feedback.
- Wrote integration-style tests on the server (auth, RBAC, migrations, limits, OpenAPI contract).

---

## What I would highlight as strengths (what shines)

These are the parts I would **point to in the repo** if the interviewer says “walk me through it.”

**Backend**

- **RBAC as data:** Roles and permissions live in PostgreSQL; the app derives **capabilities** for the current user. I’d open [`server/src/controllers/auth/me.ts`](../../server/src/controllers/auth/me.ts) (or the auth flow around `/auth/me`) and explain: user + roles + **capabilities** for the SPA.
- **Persistence and evolution:** Migrations and seeds — I’d mention [`server/package.json`](../../server/package.json) scripts like `migrate:up`, `db:seed`, and the `migrations/` folder if they want depth.
- **API contract:** [`server/src/app.ts`](../../server/src/app.ts) serves `/api/openapi.json` and Swagger UI — the client does not guess JSON shapes.
- **Rate limiting:** Redis-backed limits (global / auth / authenticated) — real abuse and `429` / `Retry-After` behavior to discuss.
- **Tests:** I’d name the scripts: `test:v2` (integration), `test:v3` (migrations), `test:v4` (rate limits), `test:v5` (OpenAPI). That shows the API layer is **checked in**, not only clicked through in a browser.

**Frontend**

- **Separation of concerns:** [`client/src/api/services.ts`](../../client/src/api/services.ts) for verbs/URLs, [`client/src/api/client.ts`](../../client/src/api/client.ts) for Axios + interceptors, [`client/src/pages/`](../../client/src/pages/) for screens — see [11 — Separation of Concerns](./11-separation-of-concerns.md).
- **Server state vs client flag:** TanStack React Query in [`client/src/main.tsx`](../../client/src/main.tsx); auth **hint** in Zustand [`client/src/store/auth.ts`](../../client/src/store/auth.ts) — I’d explain *why* I did not put the whole user object in global store ([07](./07-react-query.md), [08](./08-zustand.md)).
- **Silent refresh:** Response interceptor: single-flight refresh, `_retry`, skip login/refresh URLs — [`client/src/api/client.ts`](../../client/src/api/client.ts) ([10](./10-axios-and-interceptors.md)).
- **Capability UI:** [`client/src/hooks/useAuth.ts`](../../client/src/hooks/useAuth.ts) — `useCapabilities()` and `can("...")` aligned with backend; server still enforces ([09](./09-feature-flags-and-capabilities.md)).
- **Cache discipline:** [`client/src/constants.ts`](../../client/src/constants.ts) `queryKeys`; mutations invalidate lists — e.g. [`client/src/pages/UsersPage.tsx`](../../client/src/pages/UsersPage.tsx).
- **Documentation:** [`client/docs/`](./README.md) — unusual for a personal repo; shows I can explain the system to others.

---

## What I did not do (yet) and why

I am **honest** about scope. A lot of this comes straight from [06 — Weaknesses & Improvement Areas](./06-patterns-strengths-weaknesses.md#63-weaknesses--improvement-areas).

| Gap | Why I might defer it (simple explanation) |
|-----|-------------------------------------------|
| **No automated tests on the client** | I invested in **server** integration and contract tests first — they lock the API. Front-end tests (Vitest + RTL, or E2E) are the **next** increment; I’d start with the interceptor, `ProtectedRoute`, and `useCapabilities`. |
| **`react-hook-form` + `zod` installed but forms mostly use `useState`** | I prioritized **end-to-end RBAC flows** and a consistent page pattern. Migrating forms to schema-driven validation is a clear refactor, not a blocker to proving architecture. |
| **`window.prompt` for some edits** | Fast to ship for a learning project; I’d replace with modals or inline edit using the same confirm patterns as deletes. |
| **No React error boundaries** | I know a render throw whitescreens the SPA; adding route-level boundaries is on the list. |
| **Pagination only in component state** | Leaving `/users` and coming back resets page — I’d sync `?page=` in the URL when I polish UX. |
| **Monolithic `ui.tsx`** | Primitives live in one file for now; I’d split into a small design-system folder if the team or PR size grows. |
| **No full CI/deploy story in-repo** | Portfolio focus is **code and behavior**; I’d speak to how I’d wire GitHub Actions if asked. |

**Important nuance:** [06](./06-patterns-strengths-weaknesses.md) says there are no frontend tests — that is **true for the client**. The **server** has multiple test suites. I would **not** say “there are no tests” globally.

**Assumption I might state:** Single-developer, learning-first scope — I chose depth on authz, API contract, and backend tests over polishing every UX edge on day one.

---

## How I explain the backend (short story)

“In short, it is an **Express** app talking to **PostgreSQL**. Routes wire to controllers that use the pool and helpers for RBAC. Auth uses **HTTP-only cookies**; protected routes assume a validated session. **`GET /api/auth/me`** returns the current user, role names, and a flat **capability** list so the SPA can hide buttons without embedding role names everywhere.

Responses follow a **consistent envelope** (`AppResponse` / `AppError`) so the client can unwrap and show errors predictably. I export **OpenAPI** from code, serve `openapi.json` and Swagger UI, and the React app regenerates TypeScript from that file.

**Rate limiting** goes through **Redis** in layers so login, refresh, and normal API traffic can be tuned separately. **Migrations** keep the schema versioned.

If you want code, I’d start at [`server/src/app.ts`](../../server/src/app.ts) for the route map, then one feature route + controller.”

---

## How I explain the frontend (short story)

“It is a **Vite + React** SPA. [`client/src/main.tsx`](../../client/src/main.tsx) wraps the app in **`QueryClientProvider`** and **`BrowserRouter`**. Data fetching is **TanStack Query**: each page uses `useQuery` / `useMutation` with keys from [`client/src/constants.ts`](../../client/src/constants.ts).

All HTTP goes through **`services`** built on a shared Axios instance in [`client/src/api/client.ts`](../../client/src/api/client.ts). The **response interceptor** unwraps the API envelope, handles **401** with a **refresh + retry**, and turns failures into a small **`ApiClientError`** type for toasts.

**`ProtectedRoute`** uses **`useAuthMe`** to validate the session and syncs a persisted **`isAuthenticated`** flag in Zustand for routing UX — the **real** profile and **capabilities** stay in the React Query cache from `/me`.

The UI gates actions with **`can("resource.action")`** so it matches the server’s capability model. I’d open [`UsersPage`](../../client/src/pages/UsersPage.tsx) or another page as a template: queries, mutations, invalidate, conditional panels.”

---

## Five-point cheat sheet (if time is short)

1. **One sentence:** RoleControl IAM is a REST-backed interface for users, roles, permissions, assignments, and posts.
2. **One architecture line:** Browser → React Query → Axios (interceptors) → REST → PostgreSQL and Redis.
3. **One security line:** HTTP-only cookies, refresh path, capabilities from `/me`, **server** still authoritative on every write.
4. **One trade-off:** Zustand only for a small auth **flag**; React Query owns server data so I do not duplicate or drift from the API.
5. **One honest next step:** Client tests or migrating forms to `react-hook-form` + `zod`.

---

## Next in the simulation

After you finish this pitch, read [**Part 2 — Senior reviewer**](./15-interview-part2-senior.md) for how an experienced interviewer might react.

**Related docs:** [01](./01-architecture-overview.md), [06](./06-patterns-strengths-weaknesses.md), [hub](./13-interview-simulation.md).
