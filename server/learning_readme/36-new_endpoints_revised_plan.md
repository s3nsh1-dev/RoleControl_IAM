## Architecture Pattern Summary

| Aspect                   | Pattern                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controller structure** | Barrel file per domain (e.g. `post.controller.ts`) re-exporting from per-action files in a subdirectory (e.g. `post/listPosts.ts`)                                                                |
| **Async handling**       | Every handler wrapped in `asyncHandler(async (req, res) => { ... })`                                                                                                                              |
| **Authentication**       | `checkCookieSignature` middleware verifies the `access` JWT cookie → sets `req.user`                                                                                                              |
| **Rate limiting**        | `authenticatedRateLimiting` middleware applied at router level                                                                                                                                    |
| **Authorization (RBAC)** | `checkRolePermissions(actorId, action, resource)` — queries the DB JOIN chain `user_roles → role_permissions → permissions` to verify the actor's permission. **Never hardcoded to a role name.** |
| **Validation**           | Zod schemas from `api.contracts.ts`; `parsePositiveInt`, `parsePaginationQuery` from `validation.util.ts`                                                                                         |
| **Response**             | `new AppResponse(statusCode, message, data).send(res)`                                                                                                                                            |
| **Error**                | `throw AppError.badRequest/unauthorized/forbidden/notFound/internal(msg)`                                                                                                                         |
| **Transactions**         | `const client = await pool.connect()` → `BEGIN` → work → `COMMIT` (catch → `ROLLBACK`, finally → `client.release()`)                                                                              |
| **Audit**                | `auditDBMutation({ db: client, actorId, actionType, resourceType, resourceId, oldValues, newValues })`                                                                                            |
| **Mappers**              | Dedicated `to*()` functions in `api.mappers.ts` that parse/coerce raw DB rows into contract-safe shapes                                                                                           |
| **OpenAPI**              | All routes registered in `src/openapi/document.ts` using `registerRoute(...)` with Zod schemas                                                                                                    |
| **Constants**            | `ACTIONS_LIST`, `RESOURCES_LIST`, `ROLES_LIST` in `src/others/constants.ts`                                                                                                                       |

---

## Resolved Feedback Summary

### Q1 — Permission Distribution Per Role

**Original proposal:** Assign new permissions only to `super-admin` and partially to `admin`.

**Revised per hierarchy.ts edits:**

| Role          | New Permissions Received                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `user`        | `view:audit_log`, `view:session`, `view:migration` (all view-only)          |
| `editor`      | Inherits `user` permissions (no additional session/audit/migration perms)   |
| `admin`       | Inherits `user` + `revoke:session` (revoke a single session)                |
| `super-admin` | Inherits `user` + `revoke:session` + `delete:session` (revoke ALL sessions) |

**Key distinction:** Single session revocation uses `checkRolePermissions(actorId, 'revoke', 'session')`. Bulk revoke-all-sessions uses `checkRolePermissions(actorId, 'delete', 'session')`. This separates the privilege levels: admins can surgically revoke one session, but only super-admins can nuke all of a user's sessions.

### Q2 — Audit Logging for Revocations

**Answer:** Every action that is **not** a `view` gets logged in `audit_logs`. Both `revokeSession` and `revokeAllUserSessions` will call `auditDBMutation()`.

- Single revoke: `actionType: 'revoke'`, `resourceType: 'session'`, `resourceId: <sessionId>`
- Bulk revoke-all: `actionType: 'delete'`, `resourceType: 'session'`, `resourceId: <userId>`, with `metadata: { revokedCount, revokedSessionIds }`

### Q3 — Documentation Placement

**Answer:** Two new documentation folders under `server/docs/`:

1. `server/docs/session_management/` — explains revoke session logic and revoke endpoints only (skip view endpoints)
2. `server/docs/migrations_docs/` — explains the what/why/how of up and down migrations (covering both the original baseline migration and the new resource-types migration)

---

## Proposed Changes

### 1. Constants & Types

#### [MODIFY] [constants.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/others/constants.ts)

**Already done** — `'audit_log'`, `'session'`, `'migration'` added to `RESOURCES_LIST`.

No changes needed to `commonTypes.ts` — it derives `RESOURCES_TYPES` from `RESOURCES_LIST` automatically.

#### [ALREADY MODIFIED] [hierarchy.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/config/hierarchy.ts)

**Already done** by user — new permissions added to the hierarchy:

- `userPermissions`: `view:audit_log` (id 20), `view:session` (id 21), `view:migration` (id 22)
- `adminPermissions`: `revoke:session` (id 23)
- `superAdminPermissions`: `revoke:session` (id 23), `delete:session` (id 24)

---

### 2. Database Migration

#### [MODIFY] `migrations/202605140001_add-resource-types.sql`

The existing migration file needs to be updated to include the `delete:session` permission that was added to the hierarchy.

```sql
-- Up Migration

-- Widen the resource CHECK on the permissions table
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_resource_check;
ALTER TABLE permissions ADD CONSTRAINT permissions_resource_check
  CHECK (resource IN ('permission', 'role', 'user', 'post', 'audit_log', 'session', 'migration'));

-- Widen the resource_type CHECK on the audit_logs table
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN ('permission', 'role', 'user', 'post', 'audit_log', 'session', 'migration'));

-- Seed permissions for the new resource types
INSERT INTO permissions (action, resource, description) VALUES
  ('view',   'audit_log',  'View audit log entries'),
  ('view',   'session',    'View user session records'),
  ('revoke', 'session',    'Revoke a single user session'),
  ('delete', 'session',    'Revoke all sessions for a user'),
  ('view',   'migration',  'View database migration status')
ON CONFLICT (action, resource) DO NOTHING;

-- Down Migration

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions
  WHERE (action, resource) IN (
    ('view',   'audit_log'),
    ('view',   'session'),
    ('revoke', 'session'),
    ('delete', 'session'),
    ('view',   'migration')
  )
);

DELETE FROM permissions
WHERE (action, resource) IN (
  ('view',   'audit_log'),
  ('view',   'session'),
  ('revoke', 'session'),
  ('delete', 'session'),
  ('view',   'migration')
);

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN ('permission', 'role', 'user', 'post'));

ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_resource_check;
ALTER TABLE permissions ADD CONSTRAINT permissions_resource_check
  CHECK (resource IN ('permission', 'role', 'user', 'post'));
```

> **Note:** Role-permission assignments are handled by `db:seed` (which reads `hierarchy.ts`), not by the migration. The migration only creates the permission rows; the seed script maps them to roles.

---

### 3. Zod Contracts

#### [MODIFY] [api.contracts.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/contracts/api.contracts.ts)

Add the following, maintaining the existing codebase pattern (entity → path params → response envelopes → exports):

**Entity Schemas:**

- `AuditLogSchema` — `{ id, actor_id, actor_fullname, action_type, resource_type, resource_id, old_values, new_values, metadata, created_at }`
- `MigrationSchema` — `{ id, name, run_on }`
- `SessionSchema` — `{ id, user_id, user_fullname, expires_at, revoked_at, device_info, is_active, created_at }` — **excludes** `refresh_token_hash` for security

**Path Params:**

- `SessionIdParamsSchema` — `{ sessionId: positiveInt }`

**Response Envelopes:**

- `ListAuditLogsResponseSchema` — `{ auditLogs: AuditLogSchema[], pagination }`
- `ListMigrationsResponseSchema` — `{ migrations: MigrationSchema[], pagination }`
- `ListSessionsResponseSchema` — `{ sessions: SessionSchema[], pagination }`
- `SessionRevokeResponseSchema` — `{ session: SessionSchema }` (single revoke)
- `SessionRevokeAllResponseSchema` — `{ revokedCount: number }` (bulk revoke)

---

### 4. Data Mappers

#### [MODIFY] [api.mappers.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/contracts/api.mappers.ts)

Add three new mapper functions following the existing pattern:

- `toAuditLog(row)` — parse all audit log fields, handle nullable `actor_id`/`actor_fullname`, coerce timestamps, pass through JSONB fields
- `toMigration(row)` — parse `id`, `name`, `run_on` (coerced to ISO timestamp)
- `toSession(row)` — parse session fields, derive `is_active` from `revoked_at IS NULL AND expires_at > NOW()`

---

### 5. Controllers

All session-related logic goes in one `sessions/` folder with a `sessions.controller.ts` barrel, regardless of API path.

#### Audit Logs

##### [NEW] `controllers/audit_logs/listAuditLogs.ts`

- `asyncHandler` wrapper
- `req.user.uId` → `parsePositiveInt` → `actorId`
- `checkRolePermissions(actorId, 'view', 'audit_log')`
- Paginated `SELECT` from `audit_logs` LEFT JOIN `users` (for `actor_fullname`), ordered by `created_at DESC`
- Map via `toAuditLog`, return with `makePaginationMeta`

##### [NEW] `controllers/audit_logs.controller.ts` (barrel)

#### System / Migrations

##### [NEW] `controllers/system/listMigrations.ts`

- `asyncHandler` wrapper
- `checkRolePermissions(actorId, 'view', 'migration')`
- Paginated `SELECT` from `pgmigrations` table, ordered by `id DESC`
- Map via `toMigration`, return with `makePaginationMeta`

##### [NEW] `controllers/system.controller.ts` (barrel)

#### Sessions (all 4 handlers in one folder)

##### [NEW] `controllers/sessions/listSessions.ts`

- `checkRolePermissions(actorId, 'view', 'session')`
- Paginated `SELECT` from `user_sessions` JOIN `users`, ordered by `created_at DESC`
- Map via `toSession`

##### [NEW] `controllers/sessions/listUserSessions.ts`

- `checkRolePermissions(actorId, 'view', 'session')`
- Validate `:userId` param with `parsePositiveInt`
- Same query but filtered `WHERE us.user_id = $userId`

##### [NEW] `controllers/sessions/revokeSession.ts`

- `checkRolePermissions(actorId, 'revoke', 'session')`
- **Transaction**: `BEGIN` → `SELECT … FOR UPDATE` → validate session exists and is active → `UPDATE user_sessions SET revoked_at = NOW(), expires_at = NOW(), refresh_token_hash = 'REVOKED' WHERE id = $1` → `auditDBMutation({ actionType: 'revoke', resourceType: 'session', resourceId: sessionId })` → `COMMIT`
- No `DELETE` — uses soft-revoke as specified

##### [NEW] `controllers/sessions/revokeAllUserSessions.ts`

- `checkRolePermissions(actorId, 'delete', 'session')` ← **uses `delete` action, not `revoke`**
- Validate `:userId` param
- **Transaction**: `BEGIN` → `SELECT … FOR UPDATE` to lock active sessions → `UPDATE user_sessions SET revoked_at = NOW(), expires_at = NOW(), refresh_token_hash = 'REVOKED' WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()` → `auditDBMutation({ actionType: 'delete', resourceType: 'session', resourceId: userId, metadata: { revokedCount, revokedSessionIds } })` → `COMMIT`
- Returns `{ revokedCount }`

##### [NEW] `controllers/sessions.controller.ts` (barrel)

Re-exports all 4 handlers: `listSessions`, `listUserSessions`, `revokeSession`, `revokeAllUserSessions`

---

### 6. Routes

Three route files. All session routes (even those under `/api/users/...`) are defined in `session.route.ts` for easy navigation.

#### [NEW] `routes/audit_log.route.ts`

```
Router → checkCookieSignature → authenticatedRateLimiting
GET /  → listAuditLogs
```

#### [NEW] `routes/system.route.ts`

```
Router → checkCookieSignature → authenticatedRateLimiting
GET /migrations → listMigrations
```

#### [NEW] `routes/session.route.ts`

Exports **two routers** from the same file:

```typescript
// sessionRouter — mounted at /api/sessions
GET /                     → listSessions
PATCH /:sessionId/revoke  → revokeSession

// userSessionRouter — mounted at /api/users
GET /:userId/sessions             → listUserSessions
PUT /:userId/sessions/revoke-all  → revokeAllUserSessions
```

Both routers apply `checkCookieSignature` → `authenticatedRateLimiting`.

---

### 7. App Registration

#### [MODIFY] [app.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/app.ts)

Import and mount the new routers (after `globalRateLimiting`):

```typescript
app.use("/api/audit-logs", auditLogRouter);
app.use("/api/system", systemRouter);
app.use("/api/sessions", sessionRouter);
```

---

### 8. OpenAPI Documentation

#### [MODIFY] [document.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/openapi/document.ts)

Register 6 new `registerRoute(...)` calls. Add three new tags: `"Audit Logs"`, `"System"`, `"Sessions"`.

| Method  | Path                                      | Tag        | Summary                               |
| ------- | ----------------------------------------- | ---------- | ------------------------------------- |
| `GET`   | `/api/audit-logs`                         | Audit Logs | List paginated audit logs             |
| `GET`   | `/api/system/migrations`                  | System     | List paginated migration records      |
| `GET`   | `/api/sessions`                           | Sessions   | List all sessions (paginated)         |
| `GET`   | `/api/users/{userId}/sessions`            | Sessions   | List sessions for a specific user     |
| `PATCH` | `/api/sessions/{sessionId}/revoke`        | Sessions   | Revoke a single session               |
| `PUT`   | `/api/users/{userId}/sessions/revoke-all` | Sessions   | Revoke all active sessions for a user |

All routes use `security: protectedRouteSecurity`.

---

### 9. Documentation

#### [NEW] `docs/session_management/` folder

Contains documentation that explains:

1. The session revocation model — how `revoked_at`, `expires_at`, and `refresh_token_hash = 'REVOKED'` work together during admin revocation
2. The difference between admin revocation (`PATCH /sessions/:id/revoke` and `PUT /users/:id/sessions/revoke-all`) vs user self-logout (`POST /auth/logout`)
3. The `enforceSessionRowCapPerUser` contingency — what happens when a user exceeds `MAX_SESSION_ROWS_PER_USER = 2`
4. The RBAC split: `revoke:session` (admin, super-admin) vs `delete:session` (super-admin only)

View endpoints are intentionally excluded from this documentation.

#### [NEW] `docs/migrations_docs/` folder

Contains documentation that explains:

1. **What:** The purpose of the migration system — SQL files that version database schema changes
2. **Why:** Why the project moved from destructive `db.setup.ts` resets to incremental migrations (preserving data across schema evolution)
3. **How:** The `node-pg-migrate` workflow — `migrate:create`, `migrate:up`, `migrate:down`, `migrate:status` and the `pgmigrations` tracking table
4. **Baseline migration:** `202604130001_baseline-schema.sql` — captures the original 8-table schema
5. **New migration:** `202605140001_add-resource-types.sql` — widens CHECK constraints and seeds new permissions for `audit_log`, `session`, `migration` resources

---

## File Change Summary

| Action | File                                                  |
| ------ | ----------------------------------------------------- |
| DONE   | `src/others/constants.ts`                             |
| DONE   | `src/config/hierarchy.ts`                             |
| MODIFY | `migrations/202605140001_add-resource-types.sql`      |
| MODIFY | `src/contracts/api.contracts.ts`                      |
| MODIFY | `src/contracts/api.mappers.ts`                        |
| NEW    | `src/controllers/audit_logs/listAuditLogs.ts`         |
| NEW    | `src/controllers/audit_logs.controller.ts`            |
| NEW    | `src/controllers/system/listMigrations.ts`            |
| NEW    | `src/controllers/system.controller.ts`                |
| NEW    | `src/controllers/sessions/listSessions.ts`            |
| NEW    | `src/controllers/sessions/listUserSessions.ts`        |
| NEW    | `src/controllers/sessions/revokeSession.ts`           |
| NEW    | `src/controllers/sessions/revokeAllUserSessions.ts`   |
| NEW    | `src/controllers/sessions.controller.ts`              |
| NEW    | `src/routes/audit_log.route.ts`                       |
| NEW    | `src/routes/system.route.ts`                          |
| NEW    | `src/routes/session.route.ts`                         |
| MODIFY | `src/app.ts`                                          |
| MODIFY | `src/openapi/document.ts`                             |
| NEW    | `docs/session_management/` (revoke logic + endpoints) |
| NEW    | `docs/migrations_docs/` (what/why/how of migrations)  |

**Total: 14 new files/folders, 5 modified files, 2 already done**

---

## Verification Plan

1. **TypeScript compilation**: `pnpm run build` (or `tsc --noEmit`) — no type errors
2. **Server startup**: `pnpm run dev` — no crash, all routes registered
3. **Migration**: Run `pnpm run migrate:up` then `pnpm run db:seed` to seed the new permissions
4. **OpenAPI spec**: Regenerate `openapi.json` and verify the 6 new endpoints appear
5. **Swagger UI**: Navigate to `/api/docs` — confirm all 6 endpoints under their correct tags
6. Standalone task — no need to run previous test suites
