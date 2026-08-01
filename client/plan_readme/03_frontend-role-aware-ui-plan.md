# Frontend Role-Aware UI Plan

This file answers the frontend side of the feedback. It assumes the backend will expose a small current-user access endpoint and paginated list contracts before frontend implementation starts.

Anything from the previous combined plan that was not challenged is treated as accepted. This file focuses only on the frontend decisions that changed or need to be made explicit.

## Q: Are we putting roles or permissions in the JWT?

No.

JWT payload stays minimal. JWT is signed, not encrypted. If a token leaks, the payload is readable. `httpOnly` cookies reduce browser JavaScript exposure, but they do not make JWT payload contents private.

Frontend should not expect roles, permissions, or feature flags inside the token.

## Q: How will the frontend know the logged-in user's roles?

By calling a backend access endpoint after authentication.

Expected endpoint:

```text
GET /api/auth/me
```

Expected frontend response usage:

```ts
{
  user: {
    id: number
    fullname: string
    email: string
  }
  roles: RoleName[]
  capabilities: CapabilityKey[]
}
```

This is not a heavy auth payload. It is a normal authenticated API response. It gives the frontend the current user's access summary without exposing raw RBAC tables.

## Q: Does `/api/auth/me` replace login, refresh, or logout?

No.

Each auth endpoint has one job:

- `POST /api/auth/login`: verify credentials and set cookies.
- `GET /api/auth/refresh`: rotate/renew auth cookies.
- `POST /api/auth/logout`: revoke session and clear cookies.
- `GET /api/auth/me`: read the current authenticated user's identity, roles, and UI capabilities.

Do not merge these responsibilities. That creates unclear controller behavior.

## Q: When does the frontend call `/api/auth/me`?

Call it in these cases:

1. App boot or browser refresh.
2. Immediately after successful login.
3. After a successful access-token refresh if the app needs to revalidate capability state.
4. After role or permission mutations that could affect the current user.

The key point: browser refresh loses in-memory state, but cookies remain. Since the frontend cannot read `httpOnly` cookies, `/api/auth/me` is how the app confirms the session and rebuilds access state.

## Q: Where is this access data stored?

Use React Query as the source of truth for `/api/auth/me`.

Use Zustand only for minimal UI convenience if needed.

Strict rule:

- server state belongs in React Query
- long-lived duplicated authorization state should be avoided
- do not persist capabilities as if they are permanent truth

Practical approach:

- React Query query key: `["auth", "me"]`
- derived helper: `can(capability)`
- optional Zustand state: only `isAuthenticated` or lightweight UI session hints

If we store capabilities in Zustand, they must be refreshed from `/api/auth/me` on app boot. Otherwise stale capabilities will show wrong UI after backend role changes.

## Q: Are feature flags valid here?

Yes, but call them what they are: capability flags.

This project does not need remote rollout flags or A/B testing flags. It needs permission-derived UI capability flags.

Production systems often use several flag types:

- release flags: ship unfinished work safely
- experiment flags: A/B testing
- operational flags: disable risky behavior during incidents
- entitlement/capability flags: show features based on user access

This app needs entitlement/capability flags.

## Q: What does the frontend `can(...)` model look like?

The frontend should ask capability questions, not role questions.

Good:

```ts
can("users.create")
can("posts.delete")
can("permissions.create")
```

Bad:

```ts
role === "admin"
role === "super-admin"
```

Role checks are brittle because permissions can change in the database. Capability checks match what the user is actually allowed to do.

## Q: What capabilities should the frontend understand?

Use a stable frontend capability vocabulary:

```ts
type CapabilityKey =
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.delete"
  | "users.assignRole"
  | "users.revokeRole"
  | "roles.view"
  | "roles.create"
  | "roles.update"
  | "roles.delete"
  | "permissions.view"
  | "permissions.create"
  | "permissions.delete"
  | "rolePermissions.view"
  | "rolePermissions.assign"
  | "rolePermissions.revoke"
  | "posts.view"
  | "posts.create"
  | "posts.update"
  | "posts.delete"
  | "posts.createOnBehalf"
```

The backend should return this list for the current user. The frontend should not derive it by fetching raw role-permission tables.

## Q: Which UI stays visible to everyone?

Based on the feedback, list sections stay visible for every authenticated user.

Visible tabs:

- Users
- Roles
- Permissions
- Role permissions
- Posts

This is acceptable because `hierarchy.ts` gives every role `view` permission for users, roles, permissions, and posts.

## Q: What UI must be hidden by capability flags?

Mutation panels and row actions.

Examples:

- `CreateUserPanel` needs `users.create`.
- `EditUserButton` needs `users.update`.
- `DeleteUserButton` needs `users.delete`.
- `AssignRolePanel` needs `users.assignRole`.
- `RevokeRolePanel` needs `users.revokeRole`.
- `CreateRolePanel` needs `roles.create`.
- `EditRoleButton` needs `roles.update`.
- `DeleteRoleButton` needs `roles.delete`.
- `CreatePermissionPanel` needs `permissions.create`.
- `DeletePermissionButton` needs `permissions.delete`.
- `RolePermissionAssignPanel` needs `rolePermissions.assign`.
- `RolePermissionRevokePanel` needs `rolePermissions.revoke`.
- `CreatePostPanel` needs `posts.create`.
- `EditPostButton` needs `posts.update`.
- `DeletePostButton` needs `posts.delete`.
- `CreatePostOnBehalfControl` needs `posts.createOnBehalf`.

Do not show actions and let them fail with `403`. That is bad UI. `403` is still required for backend security, but it should not be the normal user experience.

## Q: Should the user list show roles instead of active status?

Yes.

The frontend should show assigned roles in the user list once the backend supports it.

Preferred user list columns:

```text
ID | Name | Email | Roles | Created | Actions
```

Do not show full role objects in each row. The frontend only needs role names.

Acceptable row shape:

```ts
{
  id: number
  fullname: string
  email: string
  roleNames: RoleName[]
  created_at: string
}
```

This is not JWT bloat. It is paginated API response data. It is still sensitive enough that we should keep it small.

## Q: What about pagination?

Frontend should wait for backend pagination contracts first.

Do not build client-side pagination as the final approach. It fetches too much data and becomes throwaway work after backend pagination lands.

Frontend should consume:

```text
GET /api/users?page=1&pageSize=20
GET /api/roles?page=1&pageSize=20
GET /api/permissions?page=1&pageSize=20
GET /api/role-permissions?page=1&pageSize=20
GET /api/posts?page=1&pageSize=20
```

React Query keys must include pagination:

```ts
["users", { page, pageSize }]
```

## Q: What reference should the frontend keep for role permissions?

The frontend should keep a documentation copy of the backend hierarchy for LLM/developer reference only. It should not use this static copy as runtime authorization truth.

Reference copied from `server/src/config/hierarchy.ts`:

```text
Role ranks:
- user: 1
- editor: 2
- admin: 3
- super-admin: 4

user:
- view permission
- view role
- view user
- view post
- create post

editor:
- all user permissions
- update user
- update post
- update role

admin:
- all user permissions
- assign role
- revoke role
- delete user
- delete post

super-admin:
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

Strict rule: this reference is for planning and review only. Runtime UI visibility must come from `/api/auth/me` capabilities.

## Q: What is the frontend implementation order after backend is ready?

1. Regenerate OpenAPI types from the backend.
2. Add `authApi.me`.
3. Replace persisted fake role state with `/api/auth/me` query state.
4. Add `can(capability)` and `<Can capability="...">`.
5. Wrap mutation panels and row actions.
6. Update user list to show `roleNames`.
7. Update list pages to use backend pagination.
8. Keep backend `403` handling as a safety fallback, not as primary UI control.

## Frontend Decision

Frontend will not reconstruct RBAC from raw tables.

Frontend will not use JWT payload contents for authorization UI.

Frontend will use a backend-provided current-user capability summary, then apply capability flags to hide or show UI.
