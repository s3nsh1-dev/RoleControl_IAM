# Architecture

A modular Express 5 backend in TypeScript. PostgreSQL holds the authority data
for users, roles, permissions, sessions, posts and audits. Redis backs the rate
limiters only, so a Redis outage degrades throttling, not correctness.

## Layers

```mermaid
flowchart TD
    R[routes/<br/>register paths and attach middleware] --> C[controllers/<br/>request handling, transactions, business rules]
    C --> U[utils/ + models/<br/>SQL, tokens, sessions, audit helpers]
    C --> M[contracts/<br/>Zod schemas and DTO mappers]
    M --> O[openapi/<br/>generated document]
    MW[middleware/<br/>auth, rate limits, error mapping] --> C
    U --> DB[(PostgreSQL)]
    MW --> RD[(Redis)]
```

| Layer | Owns | Does not own |
| --- | --- | --- |
| `routes/` | path shape, middleware order | any business rule |
| `controllers/` | transaction boundaries, authorization decisions, responses | raw response shaping |
| `middleware/` | authentication, rate limiting, error normalization | resource-specific rules |
| `contracts/` | request schemas, response DTOs, envelope shapes | persistence details |
| `openapi/` | the published document | validation at runtime |

## Request pipeline

The order in [src/app.ts](../src/app.ts) is deliberate. `login` and `refresh`
mount before the global limiter so a throttled client can still authenticate.

```mermaid
flowchart TD
    A[Request] --> B[express.json + urlencoded + cookieParser]
    B --> C{path}
    C -->|/api/auth/login<br/>/api/auth/refresh| D[route limiter<br/>login or refresh]
    C -->|everything else under /api| E[globalRateLimiting<br/>per client IP]
    E --> F[checkCookieSignature<br/>verifies the access cookie]
    F --> G[authenticatedRateLimiting<br/>per user id]
    G --> H[controller]
    D --> H
    H --> I{handled?}
    I -->|no match| J[notFound]
    I -->|threw| K[errorHandler]
    I -->|yes| L[AppResponse envelope]
    J --> K
    K --> M[failure envelope]
```

| Stage | File |
| --- | --- |
| Trust proxy and body parsing | [src/app.ts](../src/app.ts) |
| Login limiter | [loginRateLimiting.middleware.ts](../src/middleware/loginRateLimiting.middleware.ts) |
| Refresh limiter | [refreshRateLimiting.middleware.ts](../src/middleware/refreshRateLimiting.middleware.ts) |
| Global limiter | [globalRateLimiting.middleware.ts](../src/middleware/globalRateLimiting.middleware.ts) |
| Access cookie check | [checkCookieSignature.middleware.ts](../src/middleware/checkCookieSignature.middleware.ts) |
| Per-user limiter | [authenticatedRateLimiting.middleware.ts](../src/middleware/authenticatedRateLimiting.middleware.ts) |
| Error normalization | [errorHandler.middleware.ts](../src/middleware/errorHandler.middleware.ts) |

## Data model

```mermaid
erDiagram
    users ||--o{ user_roles : has
    roles ||--o{ user_roles : grants
    roles ||--o{ role_permissions : holds
    permissions ||--o{ role_permissions : granted_by
    users ||--o{ posts : owns
    users ||--o{ user_sessions : opens
    users ||--o{ audit_logs : performed
```

- Posts point at their author through `owner_id`.
- Audit rows keep before and after snapshots and use `ON DELETE SET NULL` for attribution, so deleting a user does not erase the trail.
- Both join tables carry a unique constraint on the pair.

Migrations in [migrations/](../migrations) are the schema source of truth. The
destructive helper is for disposable resets only, see [Operations](./operations.md).

## Authentication

Cookie-based, two JWTs, both signed with the same secret.

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as PostgreSQL

    C->>S: POST /api/auth/login
    S->>DB: verify credentials
    S->>DB: enforce session cap, then INSERT user_sessions
    DB-->>S: sessionId
    S->>DB: UPDATE refresh_token_hash for that row
    S-->>C: Set-Cookie access + refresh

    C->>S: GET /api/auth/refresh (refresh cookie)
    S->>DB: compare-and-swap the stored hash
    S-->>C: new access + rotated refresh

    C->>S: POST /api/auth/logout
    S->>DB: set revoked_at on the session row
    S-->>C: cookies cleared
```

| Token | Claims | Read by |
| --- | --- | --- |
| access | `uId`, `email` | `checkCookieSignature` on every protected router |
| refresh | `uId`, `sId`, `type: "refresh"` | the refresh and logout controllers |

Session cap: login allows 2 rows per user, enforced by
[enforceSessionRowCapPerUser](../src/utils/session.util.ts). When a third login
arrives, the oldest row is deleted first.

Relevant files: [login.ts](../src/controllers/auth/login.ts),
[refreshToken.ts](../src/controllers/auth/refreshToken.ts),
[logout.ts](../src/controllers/auth/logout.ts),
[jsonWebTokens.ts](../src/utils/jsonWebTokens.ts).

> [!WARNING]
> The access token carries no `type` claim, so a refresh token satisfies the
> access check, and `checkCookieSignature` never reads `user_sessions`. Revoking
> a session therefore does not end it. See
> [vulnerability 01](../../report/vulnerabilities/01.jwt-token-confusion-and-session-revocation-bypass.md).

## Authorization

Permission checks read the database on every request, so a role change takes
effect on the next request rather than the next login. Three things look like
the rule book, and only one of them is.

| Source | What it is | Used at runtime |
| --- | --- | --- |
| `checkRolePermissions(...)` in [helper.ts](../src/utils/helper.ts) | effective permissions resolved from `user_roles` and `role_permissions` | yes, this is the decision |
| `ROLE_RANKS` in [hierarchy.ts](../src/config/hierarchy.ts) | `user` 1, `editor` 2, `admin` 3, `super-admin` 4 | yes, for peer and escalation guards |
| `PERMISSION_HIERARCHY` in the same file | reference data for the seeder | no |

## Contracts and OpenAPI

One Zod definition drives request validation, the response DTO and the published
spec, so the three cannot drift apart.

```mermaid
flowchart LR
    Z[contracts/api.contracts.ts<br/>Zod schemas] --> V[runtime validation]
    Z --> D[openapi/document.ts]
    D --> J[GET /api/openapi.json]
    D --> S[GET /api/docs]
    D --> E[pnpm run openapi:export<br/>openapi/openapi.json]
    P[(DB rows)] --> MP[contracts/api.mappers.ts] --> V
```

Mappers exist so persistence rows never reach a client untouched. Files:
[api.contracts.ts](../src/contracts/api.contracts.ts),
[api.mappers.ts](../src/contracts/api.mappers.ts),
[document.ts](../src/openapi/document.ts),
[export.ts](../src/openapi/export.ts).

## Audit logging

Sensitive mutations write to `audit_logs` through `auditDBMutation` in
[helper.ts](../src/utils/helper.ts). The pattern is one transaction for both
writes:

1. Run the business mutation on the transaction client.
2. Insert the audit row on the same client.
3. Commit once, so a failed mutation cannot leave an orphan audit row.

---

Previous: [server/README.md](../README.md) for what the project is.
Next: [API reference](./api.md) for the routes these layers expose.
