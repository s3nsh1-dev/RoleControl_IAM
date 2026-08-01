# Backend Role-Aware UI Plan

This file answers the backend side of the feedback. The goal is to support a role-aware frontend without bloating JWTs, without dumping raw RBAC tables, and without creating endpoint sprawl.

Anything from the previous combined plan that was not challenged is treated as accepted. This file focuses only on the backend decisions that changed or need to be made explicit.

## Q: Are the current endpoints enough for the frontend to show logged-in user roles?

No.

Current frontend receives only minimal user identity after login. Existing read endpoints do not expose the current user's assigned roles.

The frontend could not reliably combine existing endpoints because:

- `GET /api/users/{userId}` does not include roles.
- `GET /api/role-permissions` tells what permissions roles have, not which roles the user has.
- there is no `GET /api/user-roles/{userId}` read endpoint.

So we need a new controller. Avoid pretending current endpoint combinations are enough. They are not.

## Q: What new backend controller is required?

Add a current-user access controller.

Preferred route:

```text
GET /api/auth/me
```

Controller responsibility:

- read authenticated user id from the access cookie/auth middleware
- fetch current user identity
- fetch assigned role names for that user
- compute effective capabilities from database-backed permissions
- return only current-user access summary

This is one task: answer "who am I and what can I do?"

It does not replace login, refresh, or logout.

## Q: Why not return roles and permissions in login or refresh?

Because login and refresh already have clear responsibilities.

- login verifies credentials and sets cookies
- refresh rotates cookies
- logout revokes session
- me/access reads current session access

Keep controllers single-purpose. This is easier to test, easier to document, and easier to reason about.

Also, do not put roles or permissions inside JWT. JWT is signed, not encrypted.

## Q: What should `/api/auth/me` return?

Return a small current-user access summary.

Recommended response:

```ts
{
  success: true
  message: string
  data: {
    user: {
      id: number
      fullname: string
      email: string
    }
    roles: RoleName[]
    capabilities: CapabilityKey[]
  }
  timestamp: string
}
```

Do not return:

- full role records with descriptions unless needed
- full permission rows
- role-permission join rows
- every role in the system
- every permission in the system

The frontend needs capabilities, not raw RBAC internals.

## Q: What are capabilities?

Capabilities are frontend-facing names derived from backend permissions.

Backend permission:

```ts
{ action: "create", resource: "post" }
```

Frontend capability:

```ts
"posts.create"
```

Recommended mapping:

```text
view:user -> users.view
create:user -> users.create
update:user -> users.update
delete:user -> users.delete

view:role -> roles.view
create:role -> roles.create
update:role -> roles.update
delete:role -> roles.delete
assign:role -> users.assignRole
revoke:role -> users.revokeRole

view:permission -> permissions.view
create:permission -> permissions.create
delete:permission -> permissions.delete
assign:permission -> rolePermissions.assign
revoke:permission -> rolePermissions.revoke

view:post -> posts.view
create:post -> posts.create
update:post -> posts.update
delete:post -> posts.delete
createOnBehalf:post -> posts.createOnBehalf
```

This mapping is backend-owned. The frontend should not duplicate the RBAC join logic.

## Q: Where should this logic live?

Add reusable model/service functions, then keep the controller thin.

Suggested backend pieces:

- auth controller: `me`
- user-role model function: get role names for user id
- permission model function: get effective permissions for user id
- contract mapper: map effective permissions to capability keys
- OpenAPI contract schema: `AuthMeResponse`

Do not bury SQL and mapping logic directly inside the controller. The controller should orchestrate.

## Q: Does `/api/auth/me` create endpoint bloat?

No.

It prevents worse endpoint bloat.

Without `/api/auth/me`, frontend would need some combination of:

- get current user
- get user roles
- get role permissions
- derive capabilities client-side

That is more calls, more coupling, and more RBAC leakage.

`/api/auth/me` is a reusable access-summary endpoint. It supports:

- app boot
- browser refresh
- post-login state hydration
- capability refresh after role/permission changes
- account menu role display
- UI authorization checks

One endpoint, one task, many frontend uses.

## Q: Do we also need `GET /api/user-roles/{userId}`?

Maybe, but not for current-user UI gating.

`GET /api/auth/me` answers current-user access.

`GET /api/user-roles/{userId}` would answer admin inspection of a selected user.

Do not add it unless we need a user detail drawer/page or role-management UI that displays roles for a specific user before mutating them.

For the user list role column, prefer adding small `roleNames` to paginated user list rows instead of forcing one API call per user.

## Q: How should the user list show roles without heavy payload?

Add small role names to the paginated user list response.

Recommended row shape:

```ts
{
  id: number
  fullname: string
  email: string
  roleNames: RoleName[]
  is_active: boolean
  created_at: string
  created_by: number | null
}
```

Frontend can display `roleNames` instead of `is_active`.

This is acceptable because:

- it is not JWT payload
- it is paginated
- it returns names only, not full role objects
- it avoids N+1 frontend calls

Do not include permissions per user row. That is too much.

## Q: What list endpoints need pagination?

Add backend pagination first.

Endpoints:

```text
GET /api/users?page=1&pageSize=20
GET /api/roles?page=1&pageSize=20
GET /api/permissions?page=1&pageSize=20
GET /api/role-permissions?page=1&pageSize=20
GET /api/posts?page=1&pageSize=20
```

Keep current named collection style.

Recommended response examples:

```ts
{
  users: UserSummary[]
  pagination: PaginationMeta
}
```

```ts
{
  posts: Post[]
  pagination: PaginationMeta
}
```

Common metadata:

```ts
type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}
```

Do not switch to generic `items` unless we intentionally refactor all list contracts. The backend already uses named collections, and consistency matters.

## Q: What does `hierarchy.ts` tell us?

`server/src/config/hierarchy.ts` currently defines:

```text
Role ranks:
- user: 1
- editor: 2
- admin: 3
- super-admin: 4

user permissions:
- view permission
- view role
- view user
- view post
- create post

editor permissions:
- all user permissions
- update user
- update post
- update role

admin permissions:
- all user permissions
- assign role
- revoke role
- delete user
- delete post

super-admin permissions:
- all user permissions
- create permission
- delete permission
- revoke permission
- assign permission
- create role
- assign role
- delete role
- revoke role
- create user
- delete user
- update user
- delete post
- update post
- createOnBehalf post
- update role
```

This supports the product rule that every role can view list sections. It does not support every role seeing mutation controls.

Important mismatch to review later: `editor` currently has `update role`. If that is intentional, frontend will expose role edit capability to editors once capabilities are wired. If that is not intended, fix the backend hierarchy before frontend implementation.

## Q: What backend files will likely change?

Likely backend changes:

- `server/src/controllers/auth/`: add `me` controller.
- `server/src/controllers/auth.controller.ts`: export/wire the controller.
- `server/src/routes/auth.route.ts`: add protected `GET /me`.
- `server/src/models/user_roles.model.ts`: add read function for user role names if missing.
- `server/src/models/role_permissions.model.ts` or permissions model: add effective permission read for user id if missing.
- `server/src/contracts/api.contracts.ts`: add `AuthMeResponse`, `CapabilityKey`, pagination schemas, and updated list response schemas.
- `server/src/contracts/api.mappers.ts`: map database permissions to capability keys and map users with `roleNames`.
- `server/src/openapi/document.ts`: document new endpoint and paginated query params/responses.
- list controllers/models: accept pagination and return totals.

Exact file names may shift based on existing module organization, but the boundaries should not.

## Q: What is the implementation order?

1. Decide final capability names.
2. Add backend capability mapping.
3. Add `GET /api/auth/me`.
4. Add user list `roleNames`.
5. Add pagination to list endpoints.
6. Update OpenAPI contracts and export `server/openapi/openapi.json`.
7. Run backend build and OpenAPI tests.
8. Only then update frontend generated types and UI.

## Q: What should not be done?

Do not:

- put roles or permissions in JWT
- make frontend derive current-user access from raw RBAC tables
- add many narrow endpoints when one reusable access summary endpoint solves the problem
- add full role/permission objects to user list rows
- rely on `403` failures as the normal UI control
- implement final frontend pagination before backend pagination contract exists

## Backend Decision

Backend should expose a small, reusable, current-user access endpoint and backend-paginated list endpoints.

This gives the frontend enough information to render correct UI without token bloat, raw RBAC leakage, or endpoint sprawl.
