# API reference

Every route is mounted under `/api`. This file is the human-readable summary.
The authoritative contract is generated from Zod schemas and served at runtime:

| What | Where | Source |
| --- | --- | --- |
| Machine-readable spec | `GET /api/openapi.json` | [src/openapi/document.ts](../src/openapi/document.ts) |
| Interactive docs | `GET /api/docs` | Swagger UI, mounted in [src/app.ts](../src/app.ts) |
| Static export | `pnpm run openapi:export` | writes [openapi/openapi.json](../openapi/openapi.json) |

When this file and `openapi.json` disagree, `openapi.json` wins.

## Naming conventions

- Path params use the resource name: `userId`, `postId`, `permissionId`, `roleName`.
- Role mutations take `roleName` in the body, never a numeric role id.
- Responses always use the envelope below and return named objects in `data`.

## Response envelope

Success, built by [AppResponse](../src/utils/AppResponse.ts). The `data` key is
omitted when a route has nothing to return.

```json
{
  "success": true,
  "message": "User created",
  "data": { "user": { "id": 12, "email": "dev@example.com" } },
  "timestamp": "2026-08-22T10:14:03.221Z"
}
```

Failure, built by [errorHandler.middleware.ts](../src/middleware/errorHandler.middleware.ts).
`status` is `fail` below 500 and `error` at 500 and above.

```json
{
  "success": false,
  "status": "fail",
  "message": "Record already exists.",
  "details": [{ "code": "invalid_type", "path": ["body", "email"], "message": "Required" }]
}
```

`details` appears only for Zod validation failures. `trace` is added only when
`NODE_ENV=development`.

### Database errors mapped to HTTP

The error middleware translates PostgreSQL codes so controllers do not need
local try/catch blocks.

| PG code | HTTP | Message |
| --- | --- | --- |
| `22001` | 400 | One of the fields is longer than the database allows. |
| `22P02` | 400 | Invalid input format. |
| `23503` | 409 | Referenced record does not exist. |
| `23505` | 409 | Record already exists. |
| `23514` | 400 | Input violates a database rule. |

## Auth

Defined in [src/routes/auth.route.ts](../src/routes/auth.route.ts). Auth splits
into two routers because `login` and `refresh` mount **before** the global rate
limiter in [app.ts](../src/app.ts), so a locked-out user can still authenticate.

| Method | Path | Global limiter | Route limiter | Cookie check |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | exempt | `loginRateLimiting` | none |
| GET | `/api/auth/refresh` | exempt | `refreshRateLimiting` | none, reads the `refresh` cookie |
| POST | `/api/auth/logout` | yes | none | none |
| GET | `/api/auth/me` | yes | none | `checkCookieSignature` |
| POST | `/api/auth/register` | yes | none | none |

Behaviour notes:

- Login sets the `access` and `refresh` cookies and creates a `user_sessions` row.
- Refresh reads the `refresh` cookie only. A valid access token is not required.
- Logout revokes the session the refresh token points at and clears both cookies.
- Register exists to bootstrap the first super-admin and is meant to be closed afterwards.

> [!WARNING]
> `logout` and `register` sit on the protected router but carry no
> `checkCookieSignature` of their own. Only `/me` applies it inline. See
> [vulnerability 14](../../report/vulnerabilities/14.auth-router-is-not-actually-protected.md).

## Protected routes

Every router below applies the same two middlewares in this order before any
handler runs:

1. [checkCookieSignature](../src/middleware/checkCookieSignature.middleware.ts), which requires the `access` cookie.
2. [authenticatedRateLimiting](../src/middleware/authenticatedRateLimiting.middleware.ts), which limits per `user.uId`.

### Users

[src/routes/user.route.ts](../src/routes/user.route.ts)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/users` | paginated list |
| POST | `/api/users` | body accepts `roleName` for the initial role |
| GET | `/api/users/:userId` | |
| PUT | `/api/users/:userId` | |
| DELETE | `/api/users/:userId` | hierarchy-checked |

### Roles

[src/routes/role.route.ts](../src/routes/role.route.ts)

| Method | Path |
| --- | --- |
| GET | `/api/roles` |
| POST | `/api/roles` |
| PUT | `/api/roles/:roleName` |
| DELETE | `/api/roles/:roleName` |

### Permissions

[src/routes/permission.route.ts](../src/routes/permission.route.ts)

| Method | Path |
| --- | --- |
| GET | `/api/permissions` |
| POST | `/api/permissions` |
| DELETE | `/api/permissions/:permissionId` |

### User roles

[src/routes/user_roles.route.ts](../src/routes/user_roles.route.ts). Both take
`roleName` in the body.

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/user-roles/:userId` | assign a role |
| DELETE | `/api/user-roles/:userId` | revoke a role |

### Role permissions

[src/routes/role_permissions.route.ts](../src/routes/role_permissions.route.ts).
All three hang off the collection path. Bodies take `roleName`, `action` and `resource`.

| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/role-permissions` | list roles with their permissions |
| POST | `/api/role-permissions` | assign a permission to a role |
| DELETE | `/api/role-permissions` | revoke a permission from a role |

### Posts

[src/routes/post.route.ts](../src/routes/post.route.ts)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/posts` | |
| POST | `/api/posts` | author is the caller |
| POST | `/api/posts/on-behalf/:userId` | author is `:userId`, caller must outrank them |
| GET | `/api/posts/:postId` | |
| PUT | `/api/posts/:postId` | |
| DELETE | `/api/posts/:postId` | |

### Sessions

[src/routes/session.route.ts](../src/routes/session.route.ts). Two routers: a flat
one at `/api/sessions` and a nested one at `/api/users/:userId/sessions` created
with `mergeParams: true`.

| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/sessions` | list all sessions |
| PATCH | `/api/sessions/:sessionId/revoke` | revoke one session |
| GET | `/api/users/:userId/sessions` | list one user's sessions |
| PUT | `/api/users/:userId/sessions/revoke-all` | revoke all of that user's sessions |

### Audit logs and system

| Method | Path | Router |
| --- | --- | --- |
| GET | `/api/audit-logs` | [audit_log.route.ts](../src/routes/audit_log.route.ts) |
| GET | `/api/system/migrations` | [system.route.ts](../src/routes/system.route.ts) |

## Unmatched routes

Anything that reaches the end of the stack hits
[notFound.middleware.ts](../src/middleware/notFound.middleware.ts), which produces
a 404 in the failure envelope shown above.

---

Previous: [Architecture](./architecture.md) for the layers these routes sit on.
Next: [Operations](./operations.md) to get a server running and serving them.
