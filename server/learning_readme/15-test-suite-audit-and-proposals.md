# Test Suite Audit & Proposed Updates

> This document compares the **existing 5-test integration suite** against the **current state of the implementation** to identify outdated assumptions, coverage gaps, and proposed test additions. No code changes — only analysis and proposals.

---

## 1. Current Test Inventory

The suite lives in [`tests/integration.test.ts`](../tests/integration.test.ts) with support files in `tests/support/`. It runs 5 tests:

| # | Test name | What it covers |
|---|-----------|----------------|
| 1 | Bootstrap registration lock | First super-admin registration → 201; second → 403 |
| 2 | Session lifecycle | Login → refresh → logout → refresh-after-logout fails |
| 3 | Session cap | 3 logins → only 2 session rows survive; oldest evicted |
| 4 | Route aliases + RBAC surfaces | Create user, view user, update user, assign role, assign permission, list role-permissions |
| 5 | Post audit logging | Create post → update post → delete post; each verified via `getAuditLogCount()` |

**Support modules:**
- [`database.ts`](../tests/support/database.ts) — `resetDatabase()`, `seedReferenceRbac()`, `createDirectUser()`, `getUserSessions()`, `getAuditLogCount()`
- [`http.ts`](../tests/support/http.ts) — `CookieClient` (cookie-aware fetch wrapper), `startTestServer()`

---

## 2. Staleness in Existing Docs & Files

These items are factually outdated and should be corrected regardless of test changes:

### 2.1 `auth.controller.ts` — Barrel file comment

```typescript
// Line 5: "Refresh Token (coming soon)"
```

Refresh token is **fully implemented** and tested. This comment is stale.

### 2.2 `docs/operations.md` — Production readiness section

> Line 76: "add automated tests"

Tests already exist and pass. This bullet should be updated or removed.

### 2.3 `docs/testing.md` — "Next Coverage Targets" section

Lines 87–94 list planned test targets that were never implemented:

```
- login invalid-credential failure
- createOnBehalf post flow
- role hierarchy restrictions for user and role mutations
- duplicate assignment/revoke edge cases
- permission CRUD edge cases
- delete-user restrictions across role boundaries
- refresh token misuse or revoked-session edge cases
```

These are still valid targets — they should either be implemented or kept as the roadmap, but the section currently reads as if they are "next up" from a past conversation. It should be updated to reflect current status.

### 2.4 `learning_readme/11-test-run-learnings.md`

This document is a **historical snapshot** from the first test run (5 tests passed, 0 failed). It's accurate for what it describes, but:
- It doesn't mention that zero new tests have been added since then
- It doesn't acknowledge how much the codebase has grown since that run (role CRUD, permission CRUD, user-role assign/revoke, role-permission assign/revoke all now have full audit logging)
- The "Final Result" section should note it's from the initial run, not a living metric

---

## 3. Coverage Gap Analysis

I traced every controller, route, and behavior in the codebase against the test file. Below is the full gap matrix.

### 3.1 Auth Domain

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Registration → 201 (first super-admin) | ✅ | — |
| Registration → 403 (second attempt) | ✅ | — |
| Registration → 400 (invalid body / missing fields) | ❌ | Zod validation for `userCreateBodySchema` is never tested with malformed input |
| Registration → audit log written (3 entries: create user + 2× assign role) | ❌ | Registration writes 3 audit logs, but the test doesn't verify `audit_logs` rows |
| Login → 200 (valid credentials) | ✅ | — |
| Login → 400/404 (wrong password) | ❌ | `compareHashStrings` rejection path is untested |
| Login → 404 (non-existent email) | ❌ | `"User not found with this email"` path is untested |
| Refresh → 200 (valid) | ✅ | — |
| Refresh → 401 (expired session) | ❌ | The `expires_at < NOW()` guard is untested |
| Refresh → 401 (revoked session, not via logout) | ❌ | Only tested via "refresh after logout"; direct revocation (e.g. admin revoking) is untested |
| Refresh → 401 (replayed old token after rotation) | ❌ | The `WHERE refresh_token_hash = <old>` replay guard is untested |
| Logout → 200 (idempotent with no cookie) | ❌ | `logout` with missing refresh cookie should still 200; untested |
| Logout → 200 (idempotent with invalid cookie) | ❌ | Best-effort try/catch path in logout is untested |

### 3.2 User Domain

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Create user → 201 | ✅ | Covered in route-alias test |
| Create user → audit log (user create + role assign) | ❌ | `createUser.ts` writes 2 audit rows; never verified |
| Create user → hierarchy guard (admin can only create editor/user) | ❌ | `canActorManageRole()` rejection for admin creating super-admin is untested |
| Create user → 400 duplicate email | ❌ | — |
| View user → 200 | ✅ | Covered in route-alias test |
| View user → 404 (non-existent ID) | ❌ | — |
| Update user → 200 (by privileged actor) | ✅ | Covered in route-alias test |
| Update user → self-update (own profile, own password) | ❌ | `actorId === targetUserId` + old-password verification is entirely untested |
| Update user → hierarchy guard (admin can't update super-admin) | ❌ | `canActorManageRole()` rejection on cross-role update |
| Update user → audit log with `{ passwordChanged: true }` metadata | ❌ | — |
| Delete user → 200 | ❌ | **No delete-user test exists at all** |
| Delete user → 403 self-deletion guard | ❌ | `"You cannot delete yourself"` is untested |
| Delete user → hierarchy guard (admin can't delete super-admin) | ❌ | — |
| Delete user → last super-admin protection | ❌ | `"Cannot delete the last super-admin"` is untested |
| Delete user → audit log | ❌ | — |
| List users → 200 | ❌ | — |

### 3.3 Role Domain

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Create role → 201 | ❌ | **No role CRUD tests exist** |
| Create role → audit log | ❌ | — |
| Update role → 200 | ❌ | — |
| Update role → hierarchy guard (can't rename to a higher role) | ❌ | `canActorManageRole(actorHighestRole, name)` rejection |
| Update role → audit log (old + new values) | ❌ | — |
| Delete role → 200 | ❌ | — |
| Delete role → hierarchy guard | ❌ | — |
| Delete role → audit log | ❌ | — |
| List roles → 200 | ❌ | — |

### 3.4 User Roles Domain

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Assign role → 201 | ✅ | Covered in route-alias test |
| Assign role → self-assignment protection | ❌ | `"You cannot assign roles to yourself"` is untested |
| Assign role → hierarchy guard (admin can't assign super-admin) | ❌ | — |
| Assign role → target-user hierarchy guard | ❌ | `canActorManageRole(actor, targetHighestRole)` path |
| Assign role → duplicate assignment (23505 constraint) | ❌ | — |
| Assign role → audit log with metadata message | ❌ | — |
| Revoke role → 200 | ❌ | **No revoke-role test exists** |
| Revoke role → self-revocation protection | ❌ | — |
| Revoke role → hierarchy guard | ❌ | — |
| Revoke role → 404 (role not assigned) | ❌ | — |
| Revoke role → audit log with metadata message | ❌ | — |

### 3.5 Permission Domain

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Create permission → 201 | ❌ | **No permission CRUD tests exist** |
| Create permission → audit log | ❌ | — |
| Create permission → 409 duplicate (UNIQUE action+resource) | ❌ | — |
| Delete permission → 200 (with CASCADE to role_permissions) | ❌ | — |
| Delete permission → audit log | ❌ | — |
| List permissions → 200 | ❌ | — |

### 3.6 Role Permissions Domain

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Assign permission → 201 | ✅ | Covered in route-alias test |
| Assign permission → audit log with metadata | ❌ | — |
| Revoke permission → 200 | ❌ | **No revoke-permission test exists** |
| Revoke permission → audit log | ❌ | — |
| Revoke permission → 404 (not assigned) | ❌ | — |
| List role-permissions → 200 | ✅ | Covered in route-alias test |

### 3.7 Post Domain

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Create post → 201 + audit log | ✅ | — |
| Update post (self, owner) → 200 + audit log | ✅ | — |
| Update post (cross-user, needs permission) → check | ❌ | Self-update skips `checkRolePermissions()`; cross-user update does not — untested |
| Delete post → 200 + audit log | ✅ | — |
| Delete post → admin can't delete super-admin's post | ❌ | `highestActorRole === "admin" && highestOwnerRole === "super-admin"` guard is untested |
| Create post on behalf → 201 + audit log (`createOnBehalf`) | ❌ | **No `createOnBehalf` test exists** — listed as "next target" in `docs/testing.md` but never written |
| Create post on behalf → 400 self-behalf guard | ❌ | `actorId === targetUserId` protection |
| Read post → 200 | ❌ | — |
| Read post → 404 | ❌ | — |
| List posts → 200 | ❌ | — |

### 3.8 Error Handling & Middleware

| Behavior | Tested? | Gap description |
|----------|:-------:|-----------------|
| Unauthenticated request → 401 | ❌ | No test hits a protected route without cookies |
| Expired access token → 401 | ❌ | `checkCookieSignature` rejection path |
| Zod validation → 400 (malformed body) | ❌ | The `ZodError` branch of `errorHandler` is never triggered by tests |
| PostgreSQL 23505 (unique violation) → 409 | ❌ | The `23505` handler in `errorHandler` is untested |
| PostgreSQL 23503 (FK violation) → 409 | ❌ | — |
| 404 for unknown routes | ❌ | `notFound` middleware is untested |

---

## 4. Test Infrastructure Gaps

### 4.1 `getAuditLogCount()` — count-only verification

The current helper only returns a count:

```typescript
const getAuditLogCount = async (actionType, resourceType, resourceId) => {
  // ... SELECT COUNT(*)::int AS count ...
}
```

This proves an audit row **exists** but not **what it contains**. For meaningful audit tests, we need a helper that returns the actual `old_values`, `new_values`, and `metadata` JSONB payloads so we can assert content.

**Proposed:** Add a `getAuditLogEntries()` helper that returns full rows.

### 4.2 `CookieClient` — no cookie-clear detection

When the server sends `Set-Cookie: access=; Max-Age=0` (on logout), the `CookieClient.captureCookies()` method stores the empty value. This works (the next request sends `cookie: access=`), but a more robust approach would be to detect `Max-Age=0` or empty values and actually *remove* the cookie from the internal map. This would let us assert `client.getCookie("access") === undefined` after logout.

### 4.3 No negative-path user helpers

`createDirectUser()` always creates valid, active users. To test `is_active = false` paths, login with invalid passwords, or users without roles, we'd need either optional flags on the helper or additional specialized helpers.

### 4.4 No helper for direct session manipulation

To test edge cases like "refresh with an expired session" or "refresh with a revoked session (not via logout)", we need a helper that can directly UPDATE a session row in the DB (set `expires_at` to the past, or `revoked_at` to NOW).

**Proposed:** Add `revokeSessionDirectly(sessionId)` and `expireSessionDirectly(sessionId)` helpers.

---

## 5. Proposed Test Additions — By Priority

### Tier 1: Critical (security + data-integrity paths)

These tests cover behaviors that, if broken, would constitute security vulnerabilities or data loss.

#### T1-A: Login with invalid credentials

```
Logic:
1. createDirectUser({ roles: ["user"] })
2. POST /api/auth/login with correct email but WRONG password
3. Assert → 400 with "Invalid password or email"
4. POST /api/auth/login with NON-EXISTENT email
5. Assert → 404 with "User not found with this email"
6. Assert: no session rows created for either attempt
```

**Why:** A broken credential-check would let anyone log in.

#### T1-B: Unauthenticated access to protected route

```
Logic:
1. DO NOT login (fresh CookieClient, no cookies)
2. GET /api/users
3. Assert → 401
4. POST /api/posts with body { title: "Test", content: "Test" }
5. Assert → 401
```

**Why:** If `checkCookieSignature` breaks, every protected route is open.

#### T1-C: Delete-user hierarchy enforcement

```
Logic:
1. createDirectUser("Super Admin", roles: ["super-admin", "user"])
2. createDirectUser("Admin", roles: ["admin", "user"])
3. createDirectUser("Target Editor", roles: ["editor", "user"])
4. Login as Admin
5. DELETE /api/users/:targetEditorId → Assert 200 (admin CAN delete editor)
6. Login as Admin again (new session since old may be affected)
7. createDirectUser("Super Admin 2", roles: ["super-admin", "user"])
8. DELETE /api/users/:superAdmin2Id → Assert 403 (admin CANNOT delete super-admin)
9. Login as Super Admin
10. DELETE /api/users/:adminId → Assert 200 (super-admin CAN delete admin)
```

**Why:** If hierarchy checks break, lower-privilege roles can nuke higher-privilege accounts.

#### T1-D: Self-deletion protection

```
Logic:
1. createDirectUser("Admin", roles: ["admin", "user"])
2. Login as Admin
3. DELETE /api/users/:ownId → Assert 403 "You cannot delete yourself"
```

**Why:** Self-deletion would lock the actor out and potentially orphan data.

#### T1-E: Last super-admin deletion protection

```
Logic:
1. createDirectUser("SA-1", roles: ["super-admin", "user"])
2. createDirectUser("SA-2", roles: ["super-admin", "user"])
3. Login as SA-1
4. DELETE /api/users/:sa2Id → Assert 200 (two SAs exist, deleting one is fine)
5. Assert: getUserSessions and DB only has SA-1 as super-admin now
6. Verify the "last super-admin" guard path by checking the count query logic
   exists and targets remain >= 1
```

**Why:** Deleting the last super-admin would make the system unrecoverable.

#### T1-F: Refresh token replay after rotation

```
Logic:
1. createDirectUser + login → get cookies
2. Capture the current refresh cookie value: oldRefresh = client.getCookie("refresh")
3. GET /api/auth/refresh → 200 (cookies rotate to new values)
4. Manually override client's refresh cookie back to oldRefresh:
   → Need setCookie("refresh", oldRefresh) on CookieClient
5. GET /api/auth/refresh → 401 (old hash no longer matches in DB)
```

**Why:** If the replay guard breaks, an attacker who captures one refresh token gets unlimited access.

---

### Tier 2: Important (RBAC correctness + full audit trail)

#### T2-A: Role CRUD lifecycle with audit

```
Logic:
1. Login as super-admin
2. DELETE /api/roles/editor → 200 (delete the seeded "editor" role)
3. Verify audit_logs has delete:role entry
4. POST /api/roles { name: "editor", description: "Re-created" } → 201
5. Verify audit_logs has create:role entry
6. PUT /api/roles/editor { description: "Updated description" } → 200
7. Verify audit_logs has update:role entry with old_values + new_values
```

**Why:** Role CRUD has no test coverage at all despite having full audit logging.

#### T2-B: User-role assign + revoke lifecycle with audit

```
Logic:
1. createDirectUser("target", roles: ["user"])
2. Login as super-admin
3. POST /api/user-roles/:targetId { rName: "editor" } → 201
4. Verify audit_logs has assign:role entry with metadata message
5. DELETE /api/user-roles/:targetId { rName: "editor" } → 200
6. Verify audit_logs has revoke:role entry with metadata message
```

**Why:** Revoke-role has zero test coverage. Assign-role is only tested for 201 status, not audit content.

#### T2-C: Role-permission revoke with audit

```
Logic:
1. Login as super-admin
2. POST /api/role-permissions { rName: "admin", action: "update", resource: "post" } → 201
3. DELETE /api/role-permissions { rName: "admin", action: "update", resource: "post" } → 200
4. Verify audit_logs has revoke:permission entry with metadata
```

**Why:** Permission revocation is completely untested.

#### T2-D: Create-on-behalf post flow

```
Logic:
1. createDirectUser("super-admin", roles: ["super-admin", "user"])
2. createDirectUser("target-user", roles: ["user"])
3. Login as super-admin
4. POST /api/posts/on-behalf/:targetUserId { title: "Behalf Post", content: "..." } → 201
5. Verify response body: owner_id === targetUserId, behalf_of === super-admin's id
6. Verify audit_logs has createOnBehalf:post entry
7. Try self-behalf: POST /api/posts/on-behalf/:ownId → 400 "Use the regular create post endpoint"
```

**Why:** `createOnBehalf` is a super-admin-exclusive feature that is entirely untested.

#### T2-E: Post delete hierarchy guard

```
Logic:
1. createDirectUser("super-admin", roles: ["super-admin", "user"])
2. createDirectUser("admin", roles: ["admin", "user"])
3. Login as super-admin → create a post
4. Login as admin
5. DELETE /api/posts/:superAdminPostId → 403 "Admin cannot delete a post owned by a super-admin"
```

**Why:** The admin-vs-super-admin post-delete guard is untested.

#### T2-F: User self-update with password change

```
Logic:
1. createDirectUser("user-1", password: "oldpass", roles: ["user"])
2. Login as user-1
3. PUT /api/users/:ownId { newPassword: "newpass" } without oldPassword → 400
4. PUT /api/users/:ownId { oldPassword: "wrong", newPassword: "newpass" } → 401 "Incorrect password"
5. PUT /api/users/:ownId { oldPassword: "oldpass", newPassword: "newpass" } → 200
6. Verify audit_logs has update:user entry with metadata.passwordChanged === true
7. Logout → login with new password → 200
```

**Why:** Self-update with password verification is the most complex update path and is entirely untested.

#### T2-G: User create hierarchy guard

```
Logic:
1. createDirectUser("admin", roles: ["admin", "user"])
2. Login as admin
3. POST /api/users { ..., rName: "super-admin" } → 403 "You cannot create a user with this role"
4. POST /api/users { ..., rName: "editor" } → 201 (admin CAN create editor)
```

**Why:** The hierarchy guard on user creation is untested — an admin could potentially escalate privileges.

#### T2-H: Audit log content verification (not just count)

```
Logic:
1. Login as super-admin → create a post
2. Update the post with a new title
3. Query audit_logs for update:post:postId (using new getAuditLogEntries helper)
4. Assert old_values.title === original title
5. Assert new_values.title === updated title
```

**Why:** Currently tests only verify audit row *existence* (count), never the actual JSONB *content*. The `old_values`/`new_values` snapshots could be wrong or empty.

---

### Tier 3: Hardening (edge cases + error handling)

#### T3-A: Zod validation errors return 400

```
Logic:
1. Login as super-admin
2. POST /api/users { email: "not-an-email", password: "ab" } → 400
3. Assert response body contains Zod validation error messages
```

#### T3-B: Duplicate resource creation returns 409

```
Logic:
1. Login as super-admin
2. POST /api/permissions { action: "view", resource: "post" } → 409 (already seeded)
3. POST /api/user-roles/:userId { rName: "user" } → 409 (duplicate assignment)
```

#### T3-C: 404 for unknown routes

```
Logic:
1. GET /api/nonexistent → 404
2. Assert response from notFound middleware
```

#### T3-D: Assign role self-protection

```
Logic:
1. Login as super-admin
2. POST /api/user-roles/:ownId { rName: "admin" } → 403 "You cannot assign roles to yourself"
```

#### T3-E: Revoke role self-protection

```
Logic:
1. Login as super-admin
2. DELETE /api/user-roles/:ownId { rName: "user" } → 403 "You cannot revoke roles from yourself"
```

#### T3-F: Permission CRUD lifecycle

```
Logic:
1. Login as super-admin
2. POST /api/permissions { action: "createOnBehalf", resource: "role" } → 201
   (this combo is valid per ACTIONS_LIST/RESOURCES_LIST but is NOT seeded by seedReferenceRbac)
3. DELETE /api/permissions/:newPermId → 200
4. Verify audit logs for both create:permission and delete:permission
```

#### T3-G: Logout idempotency

```
Logic:
1. Fresh client, no login
2. GET /api/auth/logout → 200 (succeeds with no cookies)
3. Login, logout, logout again → all 200
```

---

## 6. Test Support Improvements Needed

| Helper | Current | Proposed |
|--------|---------|----------|
| `getAuditLogCount()` | Returns count only | Keep as-is, but add `getAuditLogEntries()` returning full rows with `old_values`, `new_values`, `metadata` |
| `createDirectUser()` | Always active, always has roles | Add optional `isActive` flag for testing disabled accounts |
| — | No session manipulation | Add `expireSessionDirectly(sessionId)` and `revokeSessionDirectly(sessionId)` |
| `CookieClient` | Stores empty cookie values from `Set-Cookie: name=; ...` | Add `hasCookie(name)` that returns `false` for empty/cleared cookies |
| — | No way to override individual cookies | Add `setCookie(name, value)` and `clearCookie(name)` for replay tests (T1-F) |

---

## 7. Summary: Numbers

| Category | Current | Needed | Total after |
|----------|:-------:|:------:|:-----------:|
| Auth tests | 3 | +6 | 9 |
| User tests | 3 (partial, inside route-alias test) | +9 | 12 |
| Role tests | 0 | +4 | 4 |
| User-Role tests | 1 (partial) | +5 | 6 |
| Permission tests | 0 | +3 | 3 |
| Role-Permission tests | 2 (partial) | +2 | 4 |
| Post tests | 3 | +5 | 8 |
| Error/middleware tests | 0 | +3 | 3 |
| **Total** | **5 test functions** | **~20 new test functions** | **~25** |

---

## 8. Recommended Implementation Order

```
Phase 1 — Security critical (Tier 1)
  ├── T1-B: Unauthenticated access → 401
  ├── T1-A: Invalid credentials
  ├── T1-F: Refresh replay guard
  ├── T1-C: Delete-user hierarchy
  ├── T1-D: Self-deletion protection
  └── T1-E: Last super-admin protection

Phase 2 — RBAC correctness (Tier 2)
  ├── T2-G: User create hierarchy
  ├── T2-E: Post delete hierarchy
  ├── T2-F: User self-update with password
  ├── T2-D: Create-on-behalf
  ├── T2-B: Role assign/revoke lifecycle
  ├── T2-C: Permission revoke
  ├── T2-A: Role CRUD lifecycle
  └── T2-H: Audit content verification

Phase 3 — Hardening (Tier 3)
  ├── T3-A: Zod validation → 400
  ├── T3-B: Duplicate → 409
  ├── T3-C: Unknown route → 404
  ├── T3-D: Self-assign guard
  ├── T3-E: Self-revoke guard
  ├── T3-F: Permission CRUD lifecycle
  └── T3-G: Logout idempotency
```

---

## 9. File Structure Recommendation

If all proposed tests are implemented, the current single-file approach (`integration.test.ts`) would become unwieldy. The `docs/testing.md` already suggests this structure:

```
tests/
  auth/
    login.test.ts
    refresh.test.ts
    logout.test.ts
    registration.test.ts
  users/
    create-user.test.ts
    update-user.test.ts
    delete-user.test.ts
  roles/
    role-crud.test.ts
  user-roles/
    assign-revoke.test.ts
  permissions/
    permission-crud.test.ts
  role-permissions/
    assign-revoke.test.ts
  posts/
    post-crud.test.ts
    post-on-behalf.test.ts
  middleware/
    auth-guard.test.ts
    error-handler.test.ts
  support/
    database.ts
    http.ts
```

Each file would import the shared `before`/`after`/`beforeEach` hooks from a common setup, or each file would handle its own server lifecycle.
