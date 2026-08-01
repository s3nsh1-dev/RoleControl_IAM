# 037 - Redis Caching Architecture for Read-Heavy RBAC Checks

This document is a planning guide only. It explains how to make read-heavy authorization work faster with Redis while keeping PostgreSQL as the source of truth.

The goal is not to move important data out of PostgreSQL. The goal is to avoid repeating the same expensive database reads on every protected request.

## 1. The Core Idea

This project has two different kinds of work:

- **Writes:** creating users, assigning roles, revoking roles, assigning permissions, revoking permissions, creating posts, updating sessions, and writing audit logs.
- **Reads:** checking whether the current user has a permission, loading a user's roles, and loading a user's effective capabilities for `/api/auth/me`.

PostgreSQL should own the writes because it gives the project durable storage, relational integrity, transactions, constraints, and auditability.

Redis should handle selected repeated reads because it keeps data in memory and can answer simple key lookups much faster than a SQL join.

The industry pattern for this is:

1. Keep PostgreSQL as the **source of truth**.
2. Put Redis beside the app as a **derived read cache**.
3. Read from Redis first.
4. If Redis does not have the data, read from PostgreSQL.
5. Store the PostgreSQL result in Redis with an expiry time.
6. When PostgreSQL data changes, delete the affected Redis keys.

This is called **cache-aside**, also known as **lazy loading**.

## 2. Why This Project Is a Good Candidate

The current project already uses Redis for rate limiting:

- [server/src/config/redis.connect.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/config/redis.connect.ts)
- [server/src/utils/rateLimit.util.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/utils/rateLimit.util.ts)

So Redis is already a runtime dependency. The app already knows how to connect to Redis, detect readiness, and degrade gracefully when Redis is unavailable.

The best caching candidates are in [server/src/utils/helper.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/utils/helper.ts):

- `checkRolePermissions(actorId, action, resource)`
- `getUserRoleNames(userId)`
- `getUserEffectivePermissions(userId)`
- indirectly, `getHighestUserRole(userId)`, because it calls `getUserRoleNames`

These functions are good candidates because protected controllers call `checkRolePermissions` constantly. Many endpoints check permissions before doing their real work. Without caching, every permission check repeats joins across:

- `user_roles`
- `role_permissions`
- `permissions`
- sometimes `roles`

That is normal in a learning project, but in a read-heavy API it becomes unnecessary database pressure.

## 3. What Should and Should Not Be Cached

Cache data that is:

- read often
- small
- safe to recompute from PostgreSQL
- not the legal or permanent record
- invalidated when related writes happen

Good candidates in this project:

- a user's role names
- a user's effective permissions
- maybe a yes/no result for a specific permission check

Do not cache as the primary record:

- passwords
- refresh token hashes
- audit logs
- writes that must be durable
- database transactions
- permission changes before they are committed

PostgreSQL remains the authority. Redis only stores copies that can be deleted and rebuilt.

## 4. The Main Pattern: Cache-Aside

### Read Flow

Example request: user `15` calls `GET /api/posts`.

1. The request reaches a protected controller.
2. The controller calls `checkRolePermissions(15, "view", "post")`.
3. The helper creates a Redis key, for example `cache:rbac:user:15:permissions`.
4. The app asks Redis for that key.
5. If Redis has it, this is a **cache hit**. The app checks the permission from the cached JSON and does not query PostgreSQL.
6. If Redis does not have it, this is a **cache miss**. The app runs the existing PostgreSQL query.
7. The app stores the PostgreSQL result in Redis with a TTL.
8. The helper returns the authorization decision.

### Write Flow

Example request: an admin revokes the `editor` role from user `15`.

1. The controller starts a PostgreSQL transaction.
2. The controller deletes the row from `user_roles`.
3. The controller writes the audit log in the same transaction.
4. The transaction commits.
5. After the commit succeeds, the app deletes Redis keys for user `15`.
6. The next read for user `15` misses Redis and reloads fresh data from PostgreSQL.

Important rule: invalidate the cache **after the database commit**, not before. If the transaction rolls back, Redis should not be touched because the source data did not actually change.

## 5. Basic Terms

### Cache Hit

Redis already has the value.

Result: fast response, no PostgreSQL read for that piece of data.

### Cache Miss

Redis does not have the value.

Common reasons:

- the key was never created
- the key expired
- the key was deleted after a write
- Redis restarted and lost in-memory data

Result: read PostgreSQL, then save the result back to Redis.

### TTL

TTL means **time to live**. It is how long a Redis key should exist before Redis automatically deletes it.

For RBAC permissions, a good starting TTL is short to moderate:

- development: `60` to `300` seconds
- production starter: `300` to `900` seconds

Do not start with a very long TTL for authorization data. If invalidation has a bug, a short TTL limits how long stale permissions can survive.

### Invalidation

Invalidation means deleting cache entries when the real database data changes.

In this project, if a user's roles or a role's permissions change, cached authorization data can become stale. Stale authorization data is risky because it can allow too much access or deny access that should now be allowed.

### Source of Truth

The source of truth is the place you trust when there is disagreement.

For this project:

- PostgreSQL is the source of truth.
- Redis is a performance copy.

If Redis and PostgreSQL disagree, PostgreSQL wins.

## 6. What Redis Will Look Like

Use predictable, namespaced keys. Namespacing keeps rate-limit keys separate from cache keys.

The project already uses rate-limit keys like:

- `rate:global:ip:<ip>`
- `rate:login:ip:<ip>`
- `rate:user:<userId>`
- `rate:refresh:session:<sessionId>`

Use a separate `cache:` prefix for application caches:

- `cache:rbac:user:15:roles`
- `cache:rbac:user:15:permissions`
- `cache:rbac:user:15:permission:view:post`

Possible values:

```json
["admin", "user"]
```

```json
[
  { "action": "create", "resource": "post" },
  { "action": "view", "resource": "post" }
]
```

For this project, the most useful first key is:

```text
cache:rbac:user:<userId>:permissions
```

That one key can serve both:

- `getUserEffectivePermissions(userId)`
- `checkRolePermissions(userId, action, resource)`

This avoids caching too many small keys before the app actually needs them.

## 7. Recommended Architecture for This Codebase

Keep caching out of controllers. Controllers should continue to express business actions: assign role, revoke permission, list users, create post, and so on.

Recommended structure:

```text
server/src/
  config/
    redis.connect.ts              # existing Redis connection
  utils/
    cache.util.ts                 # generic Redis JSON get/set/delete helpers
    rbacCache.util.ts             # RBAC-specific key names and invalidation helpers
    helper.ts                     # existing authorization helper functions use cache here
```

### Generic Cache Utility

Create `server/src/utils/cache.util.ts`.

Its job:

- check whether Redis is ready
- safely read JSON
- safely write JSON with TTL
- safely delete keys
- return `null` on cache miss or Redis failure
- never crash normal request handling just because Redis is down

This follows the same degraded-mode philosophy already used by the rate limiter. For rate limiting, the current code logs a warning and bypasses when Redis is unavailable. For authorization cache, the app should log the issue and fall back to PostgreSQL.

### RBAC Cache Utility

Create `server/src/utils/rbacCache.util.ts`.

Its job:

- build key names in one place
- invalidate all cache entries affected by a user-role change
- invalidate all cache entries affected by a role-permission change

Keeping key names in one file prevents bugs where one controller writes `cache:rbac:user:15:permissions` while another tries to delete `rbac:user:15:permissions`.

### Helper Functions

Update `server/src/utils/helper.ts`.

The cache should sit inside helper functions because these are the shared read path used by controllers. If caching is implemented only inside one controller, other controllers will still hit PostgreSQL repeatedly.

The main change would be:

- `getUserEffectivePermissions(userId)` checks Redis first.
- `getUserRoleNames(userId)` checks Redis first.
- `checkRolePermissions(actorId, action, resource)` can either use cached effective permissions or keep its existing direct query until later.

Begin with `getUserEffectivePermissions` and `getUserRoleNames`. Then refactor `checkRolePermissions` to reuse cached permissions once tests prove the behavior stays correct.

## 8. Where Writes Must Invalidate Cache

Any write that changes roles or permissions must delete affected RBAC cache keys.

### User Role Writes

Files:

- [server/src/controllers/user_roles/assignRole.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/controllers/user_roles/assignRole.ts)
- [server/src/controllers/user_roles/revokeRole.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/controllers/user_roles/revokeRole.ts)

After a successful commit, invalidate:

- `cache:rbac:user:<targetUserId>:roles`
- `cache:rbac:user:<targetUserId>:permissions`

Reason: if a user gains or loses a role, both their role list and effective permission list changed.

### Role Permission Writes

Files:

- [server/src/controllers/role_permissions/assignPermission.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/controllers/role_permissions/assignPermission.ts)
- [server/src/controllers/role_permissions/revokePermission.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/server/src/controllers/role_permissions/revokePermission.ts)

After a successful commit, invalidate permissions for every user that has that role.

There are two common approaches:

1. Query PostgreSQL for users with that role, then delete `cache:rbac:user:<id>:permissions` for each user.
2. Use a versioned role-permission cache key, described below.

For this project, the beginner-friendly first implementation is option 1. It is easy to reason about and easy to test.

### Role Name or Role Hierarchy Changes

Files to inspect before implementation:

- `server/src/controllers/roles/createRole.ts`
- `server/src/controllers/roles/updateRole.ts`
- `server/src/controllers/roles/deleteRole.ts`
- `server/src/config/hierarchy.ts`

If a role is renamed, deleted, or its meaning changes, user RBAC caches can become stale. The implementation plan must include invalidation for these paths too, especially for `getHighestUserRole`.

## 9. Invalidation Strategies

### Direct Key Deletion

Delete the exact keys affected by the write.

Example:

```text
DEL cache:rbac:user:15:roles
DEL cache:rbac:user:15:permissions
```

Advantages:

- simple
- easy to test
- good first implementation

Limitations:

- role-permission changes may affect many users
- deleting many keys can become slow if one role has many users

### Short TTL Safety Net

Even with direct deletion, keep a TTL.

Why? Because invalidation code can fail. A TTL means stale data eventually disappears even if a delete was missed.

TTL is not a replacement for invalidation. It is a backup.

### Versioned Keys

A more advanced pattern is to include a version in the key:

```text
cache:rbac:user:15:permissions:v8
```

When permissions change, increment a version number. Reads use the latest version. Old keys expire naturally.

Advantages:

- avoids deleting many keys immediately
- useful at larger scale

Limitations:

- more moving parts
- harder for beginners
- not necessary as the first implementation here

## 10. Failure Behavior

Redis should improve performance, not decide whether the app works.

Recommended behavior:

- If Redis is down during a read, query PostgreSQL.
- If Redis `GET` fails, query PostgreSQL.
- If Redis `SET` fails after a PostgreSQL read, return the correct response anyway.
- If Redis `DEL` fails after a write, log the problem. The TTL limits stale data duration, but authorization-sensitive invalidation failures should be visible in logs.

This is called **graceful degradation**.

The exception is rate limiting. Some production systems prefer fail-closed rate limiting during attacks, but this project currently chooses fail-open behavior for Redis rate-limit failure. For RBAC read caching, fail-open to PostgreSQL is the correct approach.

## 11. Consistency Risks

Caching authorization data is more sensitive than caching public product lists. A stale permission can become a security issue.

Important risks:

- A revoked permission may still appear allowed until the cache is deleted or expires.
- A newly granted permission may not work until the cache is deleted or expires.
- A write may commit successfully but Redis invalidation may fail.
- Two requests can race: one request reads old data while another request is changing roles.

Mitigations:

- invalidate after successful commits
- use short TTLs at first
- keep PostgreSQL as the source of truth
- write tests around assign/revoke flows
- log cache invalidation failures
- avoid storing RBAC permissions inside JWTs, because JWT permissions cannot be invalidated easily

This project already avoids putting roles and capabilities in the access token. That is a good design choice. `/api/auth/me` derives roles and capabilities from the database today, and later it can derive them from Redis-backed helper reads.

## 12. Step-by-Step Implementation Plan

### Step 1: Add a Generic JSON Cache Helper

File:

- `server/src/utils/cache.util.ts`

Planned functions:

- `isCacheReady()`
- `getJsonCache<T>(key: string): Promise<T | null>`
- `setJsonCache(key: string, value: unknown, ttlSeconds: number): Promise<void>`
- `deleteCacheKeys(keys: string[]): Promise<void>`

The helper should use the existing `redisClient`.

### Step 2: Add RBAC Cache Keys and Invalidation Helpers

File:

- `server/src/utils/rbacCache.util.ts`

Planned functions:

- `makeUserRolesCacheKey(userId: number)`
- `makeUserPermissionsCacheKey(userId: number)`
- `invalidateUserRbacCache(userId: number)`
- `invalidateUsersPermissionsCache(userIds: number[])`

This file should own RBAC key naming.

### Step 3: Cache `getUserRoleNames`

File:

- `server/src/utils/helper.ts`

Plan:

1. Build key `cache:rbac:user:<userId>:roles`.
2. Try Redis.
3. If hit, return parsed role names.
4. If miss, run the current SQL query.
5. Store the result with TTL.
6. Return the result.

Important: when `db` is not the default pool, be careful. Some calls pass a transaction client. During a transaction, the helper may need to read uncommitted transaction state. In that case, bypass Redis and use the provided transaction client directly.

That matters because `assignRole.ts` and `revokeRole.ts` call `getHighestUserRole(userId, client)` inside a transaction.

### Step 4: Cache `getUserEffectivePermissions`

File:

- `server/src/utils/helper.ts`

Use the same cache-aside shape:

1. Build key `cache:rbac:user:<userId>:permissions`.
2. Try Redis.
3. If hit, return permissions.
4. If miss, run the existing SQL query.
5. Store the permission list with TTL.
6. Return permissions.

Again, bypass cache when a transaction client is passed.

### Step 5: Refactor `checkRolePermissions`

File:

- `server/src/utils/helper.ts`

Current behavior: runs a direct SQL join for the one requested permission.

Planned behavior after step 4 is stable:

1. Load effective permissions for the actor.
2. Check whether `{ action, resource }` exists in the cached permission array.
3. If not found, throw the same `403` error used today.

This makes most protected endpoints use the cached permission list.

### Step 6: Invalidate User Cache on User-Role Writes

Files:

- `server/src/controllers/user_roles/assignRole.ts`
- `server/src/controllers/user_roles/revokeRole.ts`

Plan:

1. Keep the existing transaction.
2. Keep the audit write inside the transaction.
3. Commit PostgreSQL.
4. Call `invalidateUserRbacCache(userId)`.
5. Send the response.

If invalidation fails, log it. The write should not be rolled back after commit just because Redis failed.

### Step 7: Invalidate Permission Cache on Role-Permission Writes

Files:

- `server/src/controllers/role_permissions/assignPermission.ts`
- `server/src/controllers/role_permissions/revokePermission.ts`

Plan:

1. Commit the role-permission change.
2. Query users assigned to the changed role.
3. Delete `cache:rbac:user:<id>:permissions` for each user.

This does not need to delete `roles` keys because the user's role names did not change. Only the permissions behind a role changed.

### Step 8: Add Tests

Add or extend integration tests around:

- first read populates cache
- second read can use cache
- assigning a role invalidates the target user's roles and permissions
- revoking a role invalidates the target user's roles and permissions
- assigning permission to a role invalidates permissions for users with that role
- revoking permission from a role invalidates permissions for users with that role
- Redis unavailable still falls back to PostgreSQL

The most important security test is: after revoking a permission or role, the user must not keep access because of stale Redis data.

## 13. Industry Standards Checklist

The implementation should follow these rules:

- Use cache-aside for derived read data.
- Keep PostgreSQL as the source of truth.
- Keep cache code out of controllers where possible.
- Centralize Redis key names.
- Always set TTLs.
- Invalidate after successful database commits.
- Bypass cache inside active database transactions unless the design explicitly handles transaction consistency.
- Treat Redis failures as performance degradation, not data correctness failure.
- Do not store sensitive secrets in Redis cache values.
- Add metrics or logs for cache hits, misses, and invalidation failures.
- Test stale-permission scenarios.

## 14. Does This Project Need It Right Now?

For learning architecture: yes, this is a strong next topic because the app already has Redis and RBAC checks happen across many routes.

For current small local traffic: not strictly. PostgreSQL can handle this project easily while it is small.

For production-style RBAC architecture: yes, but implement it carefully. Authorization caching is useful only if invalidation is reliable and tested.

The practical recommendation is:

1. Start with caching `getUserEffectivePermissions` and `getUserRoleNames`.
2. Add invalidation for role assignment and revocation.
3. Add invalidation for role-permission assignment and revocation.
4. Only then refactor `checkRolePermissions` to use cached effective permissions.
5. Keep TTL short at first.

This gives the project the industry shape without hiding authorization correctness bugs behind a cache.
