# Senior developer hireability review — RoleControl IAM client

> Written as if a staff/senior frontend engineer reviewed this repo for a **web developer hiring loop**. Based on the **post-refactor** client (`features/`, `@/` alias, ~85 files under `src/`).

---

## Verdict (one paragraph)

This is a **strong learning and portfolio project** for a **junior to solid mid-level frontend** candidate building admin/IAM UIs: modern React stack, contract-aligned API layer, cookie auth with refresh, RBAC-aware UI, and a deliberate folder refactor documented in `plan_readme/`. It is **not yet senior-production grade** because there are **no automated tests**, server state logic still lives heavily in page files, and the HTTP client is coupled to UI side effects (toasts, global store, hard redirect). For **internship / junior / “show me you can ship” roles**, I would be **interested**; for **mid on a product team with test culture**, I would **lean hire only if the interview shows you understand the gaps**; for **senior frontend**, I would expect a different depth (testing strategy, performance, a11y, design-system governance) before a yes.

**Best role fit:** Frontend engineer on an internal admin / B2B console, or full-stack leaning frontend on a small team where you own the React app against an OpenAPI backend.

---

## Pros (what helps hireability)

| Area | What you did well | Where to point in code |
|------|-------------------|------------------------|
| **Architecture** | Feature-sliced UI with barrels; pages orchestrate, components render; `@/` imports | `src/features/*/`, `src/pages/`, `09_component_delegation_refactor.md` |
| **Stack choices** | React 19, Vite, TanStack Query v5, RHF + Zod, minimal Zustand | `package.json`, `main.tsx` |
| **API contract** | OpenAPI-generated types; typed service functions; envelope unwrap in interceptor | `api/schema.ts`, `api/types.ts`, `api/services.ts`, `api/client.ts` |
| **Auth UX** | HTTP-only cookies (`withCredentials`); 401 → refresh → retry once; deduped refresh via `refreshPromise` | `api/client.ts`, `ProtectedRoute.tsx` |
| **RBAC in UI** | Capabilities from `/me`; `can()` helper; nav filtered by capability | `hooks/useAuth.ts`, `components/layout/navVisibility.ts` |
| **Async UX** | Loading skeletons, query error retry, empty states, confirm before destructive actions | `components/shared/AsyncQueryPanel.tsx`, `QueryErrorState.tsx`, `useConfirmAction.tsx` |
| **Forms** | Shared Zod schemas; resolver wired to RHF | `validation/schemas.ts` |
| **Documentation habit** | Numbered plans, refactor summary, testing guide (even if tests not implemented yet) | `client/plan_readme/` |
| **Build hygiene** | `typecheck`, `lint`, `build` scripts; strict TS options | `package.json`, `tsconfig.app.json` |

---

## Cons and risks (what hurts or caps the level)

| Area | Gap | Why interviewers care |
|------|-----|---------------------|
| **Testing** | No `test` script; zero `*.test.*` / `*.spec.*` files | Cannot verify refactor safety or regression confidence |
| **Coupling** | `api/client.ts` imports `sonner` + Zustand + `window.location` | Hard to unit-test transport; blurs layers |
| **Page weight** | Pages still own queries, mutations, forms (e.g. `UsersPage.tsx` ~187 lines) | “Container/presentational” split is partial only |
| **DRY** | Repeated invalidate + toast + `useMutation` patterns across pages | Signals missing custom hooks (`useUsersMutations`, etc.) |
| **Client RBAC** | `can()` hides UI only; backend must still enforce | Junior mistake if candidate says “frontend RBAC secures the app” |
| **E2E / CI** | No Playwright/Cypress visible in client; no client CI story in-repo | Production teams expect at least one layer of automated checks |
| **a11y / i18n** | Not systematic (focus, aria on custom controls, locales) | Required at many product companies |
| **Design system** | Small internal UI kit, not tokens/storybook-level | Fine for learning; weak for “senior design systems” bar |

---

## What a senior would ask you to do next (priority order)

1. **Add tests** — start with pure utils (`utils/rolePermissions.ts`), then `useCapabilities` with MSW + React Query test utils, then one page flow (Vitest + RTL; E2E later). You already documented the approach in `07_frontend_testing_guide.md`.
2. **Extract feature hooks** — e.g. `features/users/hooks/useUsersPage.ts` so pages are thin and testable.
3. **Decouple `api/client.ts`** — inject `onUnauthorized`, `onRateLimit`; keep axios testable.
4. **Query key factory** — extend `constants.ts` pattern; avoid stringly `invalidateQueries({ queryKey: ['users'] })` drift.
5. **Accessibility pass** — sidebar accordion, tables, dialogs (`EditDialog`, `ConfirmDialog`).

---

## Mock web developer interview simulation (45–60 minutes)

Use this to rehearse before a real loop. Interviewer persona: **mid/senior frontend** at a product company.

### Phase 1 — Opening (3 min)

**Interviewer:** “Walk me through RoleControl IAM client in two minutes. What problem does it solve and what did you own?”

**You should cover:**

- Admin console for RBAC + users + posts + sessions against a PostgreSQL API
- Cookie-based auth, OpenAPI types, capability-driven UI
- Recent refactor: feature folders + shared layout (not a rewrite of behavior)

**Red flag:** Only listing libraries without user flows or tradeoffs.

---

### Phase 2 — Live code walkthrough (15 min)

**Interviewer:** “Open `UsersPage.tsx` and `api/client.ts`. Explain data flow from click to server and back.”

**Expected path you narrate:**

1. `UsersPage` — `useQuery` / `useMutation` / `useForm` + feature components from `@/features/users`
2. `usersApi.create` in `api/services.ts` → `request()` → axios
3. Response interceptor unwraps `{ success, data }` envelope
4. On success — toast, `invalidateQueries`, form reset
5. On 401 — refresh once, retry; else clear auth and redirect login

**Follow-ups they often ask:**

- “What if two requests 401 at once?” → `refreshPromise` dedupes refresh
- “Where is the access token?” → not in JS state; HTTP-only cookies
- “Who authorizes delete user?” → server; UI only hides button via `can('users.delete')`

---

### Phase 3 — Technical deep dive (15 min)

Typical prompts (see `11_client_interview_questions.md` for full list):

| Prompt | What “good” sounds like |
|--------|-------------------------|
| React Query vs Zustand here | Query = server cache; Zustand = tiny `isAuthenticated` flag for routing hint |
| Why `retryOnMount: false` on queries | Avoid remount-driven refetch storms on errored `auth/me` (comment in `main.tsx`) |
| Stale time 20s | Reduces refetch churn on dashboard/list navigation |
| Capability nav | `visibleNavItem` filters `navItems`; child routes for sessions |
| Audit logs manual fetch | `enabled: fetchEnabled` — intentional lazy load, not a bug |

**Red flags:**

- “I’d store JWT in localStorage for simplicity” on this codebase
- “Frontend permissions are enough for security”
- Cannot explain query invalidation after mutation

---

### Phase 4 — Improvement exercise (10 min)

**Interviewer:** “You have one week before production. What do you ship first?”

**Strong answer structure:**

1. Tests for auth interceptor and `useCapabilities` (highest risk)
2. MSW contract tests for one CRUD page
3. Decouple toast from axios
4. Optional: Playwright smoke (login → create user → logout)

**Weak answer:** “Refactor CSS” or “rewrite in Next.js” without risk justification.

---

### Phase 5 — Behavioral (5 min)

**Interviewer:** “Tell me about a bug or hard decision on this project.”

Prepare **one real story** from your work, e.g.:

- Protected route refetch behavior / `retryOnMount`
- Component delegation refactor without behavior change
- Cookie `Secure` flag vs local HTTP dev (mentioned on `AuthPage`)

---

### Interviewer scoring rubric

| Signal | Lean hire | No hire |
|--------|-----------|---------|
| Explains auth + refresh clearly | Yes | Hand-wavy |
| Knows UI RBAC ≠ security | Yes | Claims frontend enforces authz |
| Names concrete files and query keys | Yes | Only buzzwords |
| Acknowledges missing tests + plan to add | Yes | “Tests aren’t needed” |
| Can propose incremental hardening | Yes | Only big-bang rewrites |

---

## Self-study before a real interview

1. Read **[11_client_interview_questions.md](./11_client_interview_questions.md)** — memorize the 10 prompts.
2. Practice aloud from **[12_client_interview_answers.md](./12_client_interview_answers.md)** — short answer first, then deep dive.
3. Re-run `pnpm typecheck && pnpm lint && pnpm build` in `client/` so you can say the project builds cleanly today.

---

## Hireability by role level (summary table)

| Level | Assessment |
|-------|------------|
| Intern / new grad | **Strong portfolio piece** |
| Junior frontend | **Hire** if communication matches code quality |
| Mid frontend | **Lean hire** — probe tests, layering, security |
| Senior frontend | **Not yet** — need test strategy + broader production craft |
| Full-stack (FE-leaning) | **Good** — shows API contract discipline |

This review is about the **client only**. Pair it with backend depth if interviewing for full-stack.
