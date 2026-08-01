# Component delegation — file map

Old path → new path (logic unchanged; JSX/hooks moved or re-exported).

## Layout

| Before | After |
|--------|-------|
| `src/components/AppShell.tsx` | `src/components/layout/AppShell.tsx` |
| (inline in AppShell) | `src/components/layout/AppSidebar.tsx` |
| (inline in AppShell) | `src/components/layout/AppTopbar.tsx` |
| (inline in AppShell) | `src/components/layout/navVisibility.ts` |
| — | `src/components/layout/index.ts` |

## Shared

| Before | After |
|--------|-------|
| Duplicate access-denied markup in pages / SessionsPage | `src/components/shared/AccessDenied.tsx` |
| `SessionsQueryResult` in SessionsPage | `src/components/shared/AsyncQueryPanel.tsx` + `features/sessions/.../SessionsQueryResult.tsx` |
| Inline edit/delete rows (Posts, Roles) | `src/components/shared/RecordCardActions.tsx` |

## Sessions

| Before | After |
|--------|-------|
| Private fns in `pages/SessionsPage.tsx` | `src/features/sessions/components/*` |
| Page exports | `pages/SessionsPage.tsx` (thin) |

## Users

| Before | After |
|--------|-------|
| Create/assign/table/edit blocks in `pages/UsersPage.tsx` | `features/users/components/CreateUserForm.tsx`, `AssignRevokeRoleForm.tsx`, `UsersTable.tsx`, `EditUserDialog.tsx` |

## Posts

| Before | After |
|--------|-------|
| Blocks in `pages/PostsPage.tsx` | `features/posts/components/CreatePostForm.tsx`, `PostCard.tsx`, `PostsList.tsx`, `EditPostDialog.tsx` |

## Roles

| Before | After |
|--------|-------|
| Blocks in `pages/RolesPage.tsx` | `features/roles/components/CreateRoleForm.tsx`, `RoleCard.tsx`, `RolesList.tsx`, `EditRoleDialog.tsx` |

## Permissions

| Before | After |
|--------|-------|
| Blocks in `pages/PermissionsPage.tsx` | `features/permissions/components/CreatePermissionForm.tsx`, `PermissionsTable.tsx` |

## Role permissions

| Before | After |
|--------|-------|
| Blocks in `pages/RolePermissionsPage.tsx` | `features/role-permissions/components/RolePermissionMutationForm.tsx`, `RolePermissionsAssignmentsTable.tsx` |

## Audit logs

| Before | After |
|--------|-------|
| `JsonPreview`, table, panel in `pages/AuditLogsPage.tsx` | `features/audit-logs/components/JsonPreview.tsx`, `AuditLogsTable.tsx`, `AuditLogsPanel.tsx` |

## Migrations

| Before | After |
|--------|-------|
| Table block in `pages/MigrationsPage.tsx` | `features/migrations/components/MigrationsTable.tsx` |

## Auth

| Before | After |
|--------|-------|
| Hero + form in `pages/AuthPage.tsx` | `features/auth/components/AuthMarketingCopy.tsx`, `AuthCredentialsForm.tsx` |

## Dashboard

| Before | After |
|--------|-------|
| Stats + notes in `pages/DashboardPage.tsx` | `features/dashboard/components/DashboardStatsGrid.tsx`, `OperationalNotesPanel.tsx` |

## Config

| File | Change |
|------|--------|
| `vite.config.ts` | `resolve.alias['@']` → `src` |
| `tsconfig.app.json` | `paths: { "@/*": ["./src/*"] }` |
| `src/App.tsx` | imports `@/components/layout` |
