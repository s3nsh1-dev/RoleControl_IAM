# RoleControl IAM audit report

**Audited:** 7 August 2026 · **Branch:** `dev` @ `7d184f4`
**Scope:** full stack — `server/` (Express 5 + TypeScript + PostgreSQL + Redis) and `client/` (Vite + React 19 + TanStack Query)
**Output:** 23 vulnerabilities · 20 suggestions

| | |
|---|---|
| [→ Vulnerabilities index](./vulnerabilities/index.md) | 23 findings, ranked, by theme and by side |
| [→ Suggestions index](./suggestions/index.md) | 20 suggestions, ranked, with supersession map |

---

## The one-paragraph version

The RBAC engine at the centre of this project is **correct**. Five normalised
tables, permissions resolved from the database on every request rather than baked
into a token, a clean `action × resource` model, transactions with row locks
everywhere they belong, an audit log with before/after snapshots, and a
Zod → OpenAPI → TypeScript contract pipeline that most production teams do not
build. That is the hard part and you got it right.

The problems are almost entirely in the **layer around** it. Session state is
tracked in the database but never consulted when a request arrives, so nothing in
the system can actually terminate a session. The seeded permission sets give
every account read access to every user, session and audit entry. The deployment
configuration assumes localhost. And a set of controls — `is_active`, session
revocation, rate limiting — are *built* but not *wired*, which is a specific and
recognisable failure mode: the mechanisms exist, they just are not consulted at
the moment of decision.

None of this requires a rewrite. The single most important finding
([01](./vulnerabilities/01.jwt-token-confusion-and-session-revocation-bypass.md))
is roughly twenty lines in one middleware, and it makes four other findings
effective as a side effect.

---

## Project score

### Today: **5.5 / 10**

| Dimension | Score | Reasoning |
|---|---|---|
| Data model & schema design | **9** | Properly normalised, correct cascade directions, `ON DELETE SET NULL` on audit attribution, unique constraints on both join tables, sensible indexes. Genuinely production-shaped. |
| RBAC engine correctness | **8** | Permissions resolved live from the database; two-layer capability + hierarchy model; role changes take effect on the next request, not the next login. |
| Transaction & concurrency handling | **8** | `FOR UPDATE` used consistently, `finally { client.release() }` in all 15 transactional controllers, no lost-update bugs. Docked for the connection-acquisition bug ([08](./vulnerabilities/08.pool-starvation-from-permission-checks-inside-transactions.md)). |
| API contract & typing | **8** | One Zod definition drives validation, the OpenAPI spec, and the client's types. `strict: true` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. |
| Client architecture | **7** | No credentials in JavaScript, capabilities from the server, feature-folder structure, real tests. Small gaps in cache lifecycle and route guarding. |
| Code organisation | **7** | One controller per file, clear layer names, DTO mappers at every boundary. Held back by a dead `models/` directory and no service layer. |
| Testing | **6** | Five versioned server suites plus Vitest and Playwright on the client — well above average. But the authorization matrix is sampled, not exhaustive, and every finding here is an untested cell. |
| **Authentication & session security** | **3** | The critical weakness. Revocation does not revoke, deactivation does not deactivate, password changes do not invalidate, and a refresh token authenticates as an access token. |
| **Authorization scope** | **4** | The engine is right; the seeded data is far too permissive and the hierarchy layer is applied to 8 of 10 relevant endpoints. |
| **Operational readiness** | **3** | No security headers, no CORS policy, secrets with defaults, no health endpoint, unfinished shutdown, `pnpm build` emits no JavaScript. |
| Observability | **4** | Excellent mutation audit trail; zero authentication events; 40 unstructured `console.*` calls; 500s log nothing at all. |

**Weighted to 5.5** because for an *identity and access management* system, the
authentication and authorization dimensions carry more weight than the rest. The
same codebase, judged as a generic CRUD API, would score around 7.

### After Phases 1–3 below: **8.5 / 10**

| Dimension | Today | After | What changes it |
|---|---|---|---|
| Authentication & session security | 3 | **9** | Findings [01](./vulnerabilities/01.jwt-token-confusion-and-session-revocation-bypass.md), [03](./vulnerabilities/03.deactivated-users-can-still-log-in.md), [04](./vulnerabilities/04.password-change-does-not-revoke-sessions.md), [05](./vulnerabilities/05.refresh-token-rotation-without-reuse-detection.md), [18](./vulnerabilities/18.weak-password-policy.md) |
| Authorization scope | 4 | **9** | Findings [02](./vulnerabilities/02.overpermissive-default-user-role.md), [06](./vulnerabilities/06.role-rename-privilege-escalation.md), [11](./vulnerabilities/11.session-revocation-and-peer-actions-lack-hierarchy-checks.md), [12](./vulnerabilities/12.rbac-self-destruct-via-role-and-permission-deletion.md), [20](./vulnerabilities/20.updatepost-and-post-ownership-inconsistencies.md) + Suggestion [01](./suggestions/01.centralize-authorization-in-middleware.md) |
| Operational readiness | 3 | **8** | Findings [09](./vulnerabilities/09.jwt-secret-and-credentials-default-to-placeholders.md), [10](./vulnerabilities/10.no-security-headers-no-cors-policy-and-cookie-flags.md), [13](./vulnerabilities/13.unauthenticated-openapi-and-docs-exposure.md), [22](./vulnerabilities/22.trust-proxy-misconfiguration-enables-limit-bypass.md) + Suggestions [05](./suggestions/05.postgres-and-redis-production-config.md), [07](./suggestions/07.health-readiness-and-graceful-shutdown.md), [13](./suggestions/13.environment-config-and-secret-management.md), [14](./suggestions/14.docker-compose-and-reproducible-dev-env.md) |
| Observability | 4 | **8** | Finding [17](./vulnerabilities/17.no-authentication-audit-trail.md) + Suggestion [06](./suggestions/06.structured-logging-and-request-ids.md) |
| Testing | 6 | **8** | Suggestion [15](./suggestions/15.authorization-test-matrix.md) |
| Transaction handling | 8 | **9** | Suggestion [02](./suggestions/02.thread-transaction-client-through-helpers.md) |

Reaching **9.5** would additionally need Suggestions
[03](./suggestions/03.database-driven-role-hierarchy.md) (runtime-definable
roles) and [04](./suggestions/04.service-layer-and-repositories.md) (service
layer) — both large, both optional, and both changing what the product *is*
rather than whether it is correct.

---

## What to tackle first

Four phases. Each is independently shippable and leaves the system better than it
found it. **Do not reorder Phase 1.**

### Phase 1: Make sessions real (1–2 days)

Nothing else in this report matters until an operator can end a session.
Today, no action available in the system does that.

| Order | Item | Why here |
|---|---|---|
| 1 | [V01 · token confusion + session binding](./vulnerabilities/01.jwt-token-confusion-and-session-revocation-bypass.md) | **The keystone.** Everything below depends on it. |
| 2 | [V03 · enforce `is_active`](./vulnerabilities/03.deactivated-users-can-still-log-in.md) | One clause of V01's query. Same edit. |
| 3 | [V04 · revoke sessions on credential change](./vulnerabilities/04.password-change-does-not-revoke-sessions.md) | Introduces `revokeAllSessionsForUser`, used by three findings. |
| 4 | [V05 · refresh reuse detection](./vulnerabilities/05.refresh-token-rotation-without-reuse-detection.md) | Uses the same helper; changes 400 → 401 so the client handles it. |
| 5 | [V14 · honest auth router](./vulnerabilities/14.auth-router-is-not-actually-protected.md) | Five-line routing fix; closes the bootstrap door. |

Write the failing tests from
[S15](./suggestions/15.authorization-test-matrix.md)'s authentication section
**before** the fixes. Watching them go red then green is the proof.

### Phase 2: Close the authorization gaps (1–2 days)

| Order | Item | Why here |
|---|---|---|
| 1 | [V02 · over-permissive `user` role](./vulnerabilities/02.overpermissive-default-user-role.md) | Highest blast radius remaining. Also a prerequisite for V17. |
| 2 | [V06 · role-name hierarchy](./vulnerabilities/06.role-rename-privilege-escalation.md) | **Decide Option A vs B first** — see contradictions below. Sets `>` vs `>=` for everything after. |
| 3 | [V11 · missing hierarchy checks](./vulnerabilities/11.session-revocation-and-peer-actions-lack-hierarchy-checks.md) | Introduces `assertCanManageUser`. |
| 4 | [V20 · post ownership consistency](./vulnerabilities/20.updatepost-and-post-ownership-inconsistencies.md) | Consumes that helper. |
| 5 | [V12 · RBAC self-destruct guards](./vulnerabilities/12.rbac-self-destruct-via-role-and-permission-deletion.md) | Shares V06's migration. **One migration, both findings.** |

### Phase 3: Make it deployable (2–3 days)

| Order | Item | Why here |
|---|---|---|
| 1 | [S17 · repo hygiene + root `.gitignore`](./suggestions/17.repository-hygiene-and-generated-artifacts.md) | Fifteen minutes. Prerequisite for everything below that adds a root `.env`. |
| 2 | [S13 · env config](./suggestions/13.environment-config-and-secret-management.md) — absorbing [V09](./vulnerabilities/09.jwt-secret-and-credentials-default-to-placeholders.md), [V10](./vulnerabilities/10.no-security-headers-no-cors-policy-and-cookie-flags.md), [V13](./vulnerabilities/13.unauthenticated-openapi-and-docs-exposure.md), [V14](./vulnerabilities/14.auth-router-is-not-actually-protected.md), [V22](./vulnerabilities/22.trust-proxy-misconfiguration-enables-limit-bypass.md), [S05](./suggestions/05.postgres-and-redis-production-config.md), [S06](./suggestions/06.structured-logging-and-request-ids.md) | **Six findings edit `envHelper.ts`. Edit it once.** |
| 3 | [S05 · pool and Redis config](./suggestions/05.postgres-and-redis-production-config.md) + [V08 · pool starvation](./vulnerabilities/08.pool-starvation-from-permission-checks-inside-transactions.md) | Must land together — see contradictions. |
| 4 | [V10 · helmet, CORS, cookie flags](./vulnerabilities/10.no-security-headers-no-cors-policy-and-cookie-flags.md) + [V22 · `TRUST_PROXY`](./vulnerabilities/22.trust-proxy-misconfiguration-enables-limit-bypass.md) | Must land together — see contradictions. |
| 5 | [V07 · fail-closed auth limiters](./vulnerabilities/07.rate-limiters-fail-open.md) | Requires S05's Redis timeouts first. |
| 6 | [V13](./vulnerabilities/13.unauthenticated-openapi-and-docs-exposure.md) + [V19](./vulnerabilities/19.nested-session-routes-run-auth-and-rate-limit-twice.md) | Both are `app.ts` mount-order fixes. One pass. |
| 7 | [S07 · health + shutdown](./suggestions/07.health-readiness-and-graceful-shutdown.md), [S06 · logging](./suggestions/06.structured-logging-and-request-ids.md), [V17 · auth audit trail](./vulnerabilities/17.no-authentication-audit-trail.md) | V17 **must** come after V02. |
| 8 | [S14 · Docker compose](./suggestions/14.docker-compose-and-reproducible-dev-env.md) | Needs S07's health endpoints. Will surface the broken `dist` build. |

### Phase 4: Structural improvements (ongoing)

Now that behaviour is correct, improve the shape.
[S02](./suggestions/02.thread-transaction-client-through-helpers.md) →
[S01](./suggestions/01.centralize-authorization-in-middleware.md) →
[S08](./suggestions/08.single-validation-middleware.md) →
[S15](./suggestions/15.authorization-test-matrix.md) →
[S16](./suggestions/16.openapi-as-contract-source-of-truth.md) →
client work ([S10](./suggestions/10.client-capability-guard-component.md),
[S11](./suggestions/11.react-query-cache-hardening.md),
[S12](./suggestions/12.axios-refresh-interceptor-correctness.md),
[S20](./suggestions/20.accessibility-and-dialog-focus-management.md)).

Optional and large: [S03](./suggestions/03.database-driven-role-hierarchy.md),
[S04](./suggestions/04.service-layer-and-repositories.md).

---

## Contradictions and ordering constraints

These are the places where implementing two findings independently produces
conflicting code. **Read this section before writing anything.**

### Genuine either/or: pick one

| Decision | Option A | Option B | Recommendation |
|---|---|---|---|
| **Role hierarchy** | [S03](./suggestions/03.database-driven-role-hierarchy.md): `roles.rank` column, runtime-definable roles | [V06 Option B](./vulnerabilities/06.role-rename-privilege-escalation.md): make `roles.name` immutable, delete `POST/DELETE /api/roles` | **B if this stays a four-role system** (3 lines, closes the hole). **A if you want it to be a real RBAC product.** Doing B then A means writing code you delete. |
| **Bootstrap recovery** | [V14](./vulnerabilities/14.auth-router-is-not-actually-protected.md) option 3: `BOOTSTRAP_TOKEN` header on `POST /api/auth/register` | [V14](./vulnerabilities/14.auth-router-is-not-actually-protected.md) option 4: delete the endpoint, use a CLI script | **Option 4.** An endpoint that must fire once per deployment lifetime does not belong in the HTTP surface. But [V12](./vulnerabilities/12.rbac-self-destruct-via-role-and-permission-deletion.md) also wants a recovery path — make that a CLI script too, and drop `BOOTSTRAP_TOKEN` from both. |
| **Token error codes** | [V23](./vulnerabilities/23.error-messages-leak-internal-detail.md) step 2 / [S18](./suggestions/18.error-taxonomy-and-client-mapping.md): distinguish `TOKEN_EXPIRED` from `TOKEN_INVALID` | Keep the single opaque 401 | **Only add codes if [S12](./suggestions/12.axios-refresh-interceptor-correctness.md) uses them.** Otherwise you have given an attacker a token-state oracle for no gain. |

### Must land together

| Pair | Why |
|---|---|
| [V10 CORS/HSTS](./vulnerabilities/10.no-security-headers-no-cors-policy-and-cookie-flags.md) + [V22 `TRUST_PROXY`](./vulnerabilities/22.trust-proxy-misconfiguration-enables-limit-bypass.md) | HSTS implies TLS termination implies a reverse proxy. Ship V10 alone → every IP rate limiter buckets all traffic under the proxy's address (self-inflicted outage). Ship V22 as `true` → every limiter becomes forgeable. |
| [V07 fail-closed limiters](./vulnerabilities/07.rate-limiters-fail-open.md) + [S05 Redis timeouts](./suggestions/05.postgres-and-redis-production-config.md) | Fail-closed makes Redis a hard dependency for login. Without `commandTimeout`, a hung Redis becomes a total login outage. You would trade a security bug for an availability incident. |
| [V08 pool starvation](./vulnerabilities/08.pool-starvation-from-permission-checks-inside-transactions.md) + [S05 pool config](./suggestions/05.postgres-and-redis-production-config.md) | `connectionTimeoutMillis: 0` turns the deadlock from recoverable into permanent. And [V01](./vulnerabilities/01.jwt-token-confusion-and-session-revocation-bypass.md) adds a per-request query that raises pool pressure. |
| [V06 hierarchy](./vulnerabilities/06.role-rename-privilege-escalation.md) + [V12 system-row guards](./vulnerabilities/12.rbac-self-destruct-via-role-and-permission-deletion.md) + [S03](./suggestions/03.database-driven-role-hierarchy.md) | All three add columns to `roles`. **One migration** (`rank`, `is_system` on roles; `is_system` on permissions), not three. |

### Hard prerequisites

```
V01 (session state checked per request)
 ├── V03  deactivation cannot take effect without it
 ├── V04  revoking sessions on password change is a no-op without it
 ├── V05  reuse detection revokes a family that still works without it
 ├── S19  "sign out this device" is a button that does nothing without it
 └── S18  SESSION_REVOKED is not a reachable state without it

V02 (audit log stops being world-readable)
 └── V17  do NOT add IPs, user agents and failed logins to a table
           every authenticated user can read

V06 / S03 (the > vs >= decision, and where rank lives)
 ├── V11  assertCanManageUser inherits the semantics
 └── V20  assertCanActOnPost inherits it too

S17 (root .gitignore)
 └── S13 → S14  both introduce root-level .env files

S05 (closeDbPool export)
 └── S07  graceful shutdown needs it

S07 (/healthz)
 └── S14  container healthchecks need something to call

S11 (exported queryClient)
 ├── S12  the interceptor imports it
 └── V16  the 401 path clears the cache with it
```

### Subtle conflicts to watch

**The `is_active` check must go *after* bcrypt.**
[V03](./vulnerabilities/03.deactivated-users-can-still-log-in.md) adds a
deactivation check to login;
[V15](./vulnerabilities/15.login-user-enumeration-via-timing.md) removes a timing
oracle by always paying the bcrypt cost. Putting the `is_active` check *before*
`compareHashStrings` "to avoid pointless hashing" undoes V15 and creates a new
oracle distinguishing suspended accounts from nonexistent ones. Both findings
contain the reconciled code; use it.

**Login must never return `ACCOUNT_DEACTIVATED`.**
[S18](./suggestions/18.error-taxonomy-and-client-mapping.md) introduces that
error code. At the *login* endpoint it must stay `CREDENTIALS_INVALID`; the
deactivation code is only for *authenticated* requests. Otherwise
[V15](./vulnerabilities/15.login-user-enumeration-via-timing.md) is undone.

**`requirePermission` middleware cannot express "or it's your own row".**
[S01](./suggestions/01.centralize-authorization-in-middleware.md) moves capability
checks to routes.
[V02](./vulnerabilities/02.overpermissive-default-user-role.md) needs a
*non-throwing* `hasRolePermission` for endpoints that filter rather than reject.
Design both together, or the middleware will not accommodate the fix.

**Fix [V19](./vulnerabilities/19.nested-session-routes-run-auth-and-rate-limit-twice.md)
before adding more router-level middleware.** The nested-mount bug means
`userRouter`'s middleware runs on `/api/users/:id/sessions` too. Add
`requirePermission` or `validate` at router level and they double-execute as well.

---

## Correct patterns already in this codebase

Worth naming explicitly, both because they are load-bearing for the fixes above
and because you should keep doing them.

**Schema and data model**

- Fully normalised RBAC: `users → user_roles → roles → role_permissions → permissions`, with `UNIQUE` on both join tables so a duplicate grant is impossible.
- `ON DELETE SET NULL` on `audit_logs.actor_id` rather than `CASCADE` — deleting a user preserves the record of what they did instead of erasing the evidence. A deliberate, security-aware choice most schemas get wrong.
- `CHECK` constraints on `permissions.action` / `.resource` derived from the same TypeScript constants the application uses.
- `CONSTRAINT check_behalf_not_self` — a real business invariant enforced in the database.
- Composite index `(resource_type, resource_id, created_at DESC)` shaped for the actual query pattern.

**Concurrency and transactions**

- `SELECT ... FOR UPDATE` before every mutation, in all ten places it belongs.
- `try { BEGIN … COMMIT } catch { ROLLBACK; throw } finally { client.release() }` in 15 of 15 transactional controllers. Not one leaked connection.
- Optimistic concurrency on refresh rotation (`WHERE … AND refresh_token_hash = $5`) so two concurrent refreshes cannot both succeed.
- `SELECT ... FOR UPDATE` on the `super-admin` role row as a distributed mutex for bootstrap. Genuinely sophisticated.
- `QueryableDb = Pick<PoolClient | Pool, "query">` — exactly the right structural type for threading a connection through helpers.

**Authentication and cryptography**

- Tokens in `httpOnly` cookies, never in `localStorage`. No credential is reachable from JavaScript.
- `sameSite: "strict"` — which is why there is no CSRF finding in this report.
- Refresh tokens stored as `bcrypt(sha256(token))`. The sha256 pre-hash sidesteps bcrypt's 72-byte truncation on long JWTs — a subtle detail, handled.
- `jwt.verify` pins `algorithms: ["HS256"]`, closing the classic algorithm-confusion attack.
- `INVALID_LOGIN_MESSAGE` as a shared constant across both login failure branches.
- `sanitizeUserRecord` applied at every response and audit boundary. Password hashes never leak, anywhere.

**Rate limiting**

- A correct sliding-window in a single atomic Lua `EVAL` — `ZREMRANGEBYSCORE` + `ZCARD` + conditional `ZADD` + `PEXPIRE`. Most hand-rolled limiters get this wrong.
- Layered keys: per-IP, per-email+IP, per-session, per-user, plus a global tier.
- `sha256(email|ip)` as the failure key — correlates attempts without storing addresses in Redis.
- `clearRateLimitKey` on successful login.
- `normalizeIpForRateLimit` strips the `::ffff:` IPv4-mapped prefix so one client gets one bucket.

**API design**

- Zod → `zod-to-openapi` → `openapi-typescript` → client types. One definition, three consumers, no drift by construction.
- `AppResponse` with a custom `toJSON`, so every response has an identical envelope.
- Explicit DTO mappers (`toUserSummary`, `toSession`, …) at every boundary — no database row is ever spread into JSON.
- `toCapabilityKeys` translating internal `action:resource` pairs into a stable UI vocabulary, insulating the client from the permission model.
- `errorHandler` distinguishing `isOperational` errors from internal ones, and translating PostgreSQL error codes into safe messages.
- `satisfies readonly RoleName[]` on the client's `roleNames` constant, so a contract change breaks the build.

**Client architecture**

- `ProtectedRoute` gates on the server's `/api/auth/me` response, not on local state. This is why the one client-side finding is a 4 and not an 8.
- Capabilities fetched from the server on every load and used for nav visibility and page guards.
- Feature-folder structure (`features/users/components/…`) with barrel exports.
- `navVisibility.ts` — recursive, declarative, unit-tested, and correctly collapses empty nav groups.
- `keepPreviousData` on paginated queries; `ErrorBoundary` wrapping the provider tree.
- Backdrop dismissal on `mousedown` rather than `click`, avoiding the drag-out-of-dialog bug.

**Configuration and tooling**

- One `envHelper.ts` parsing `process.env` through Zod, with `.describe()` on every key. Zero direct `process.env` reads elsewhere. This single decision is why six separate findings each land in one file.
- `tsconfig` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Genuinely strict.
- Versioned migrations via `node-pg-migrate` with up *and* down for every change.
- A fully idempotent seed script (`ON CONFLICT … DO UPDATE` / `DO NOTHING`).
- Five versioned test suites with `--test-concurrency=1`, plus Vitest with MSW and Playwright e2e.
- ~84 markdown files of design analysis and decision records. Unusual, and worth keeping.

---

## How to read a finding

Each file follows the same structure: a header table (rank, side, category,
files), **the finding** with code excerpts and line references, **why it matters**
with honest severity framing, an **exploit walkthrough** or reproduction,
**the fix** with concrete code, **interaction with other findings** — the section
to read before you start — and **what you already got right**, which is not
padding: several fixes depend on the good patterns already present, and knowing
which ones lets you extend rather than replace.

Where I have overstated or understated something, the "why it matters" section
says so explicitly. Findings [13](./vulnerabilities/13.unauthenticated-openapi-and-docs-exposure.md),
[16](./vulnerabilities/16.client-auth-flag-is-persisted-and-forgeable.md) and
[23](./vulnerabilities/23.error-messages-leak-internal-detail.md) in particular
are ranked lower than a scanner would rank them, with the reasoning given.

---

Previous: [Repository README](../README.md).
Next: [Vulnerabilities index](./vulnerabilities/index.md), 23 findings ranked by severity.
