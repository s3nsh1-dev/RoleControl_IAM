# Component delegation refactor (May 2026)

## Why

The client pages had grown into large files that mixed React Query wiring, forms, tables, and JSX. This refactor splits UI into **feature components** and **shared/layout** pieces while keeping **behavior identical** (same API calls, query keys, validation, capability gates, and user-visible flows).

## What did NOT change

- [`src/api/`](../src/api/) — transport, services, OpenAPI types
- [`src/validation/schemas.ts`](../src/validation/schemas.ts) — zod + react-hook-form rules
- [`src/store/auth.ts`](../src/store/auth.ts) — persisted auth flag
- Query keys in [`src/constants.ts`](../src/constants.ts)
- RBAC `can(...)` checks and mutation success/error handling (toasts, invalidations, confirmations)

## Final `src/` layout

```text
src/
  api/                    # HTTP client, services, generated schema types
  hooks/                  # useAuth, useConfirmAction, useTheme
  store/                  # Zustand auth session flag
  validation/             # Zod schemas
  utils/                  # format, rolePermissions grouping
  constants.ts            # queryKeys, navItems

  components/
    ui/                   # design system (Button, Panel, Field, …)
    ui.tsx                # barrel
    layout/               # AppShell, sidebar, topbar, nav visibility
    shared/               # AccessDenied, AsyncQueryPanel, RecordCardActions
    ProtectedRoute.tsx
    QueryErrorState.tsx
    PaginationControls.tsx
    ThemeToggle.tsx
    ErrorBoundary.tsx

  features/
    <domain>/
      components/         # one named component per file
      index.ts            # public barrel for pages

  pages/                  # route orchestrators (queries/mutations + composition)
  App.tsx
  main.tsx
```

## Path alias and import rules

- **`@/*`** → `src/*` (configured in `vite.config.ts` and `tsconfig.app.json`)
- **Pages** import feature UI from barrels: `import { UsersTable } from '@/features/users'`
- **Do not** import deep paths from pages: avoid `@/features/users/components/UsersTable`
- **Features** may use `@/components/ui`, `@/components/shared`, `@/api`, `@/validation/schemas`, `@/utils` — not other `features/*`
- **Layout** may use `@/hooks`, `@/api`, `@/constants`, `@/store` — not feature internals
- Use `import type` for type-only imports (`verbatimModuleSyntax`)

## Feature public exports

| Feature | Barrel [`index.ts`](../src/features/) exports |
|---------|-----------------------------------------------|
| `users` | `CreateUserForm`, `AssignRevokeRoleForm`, `UsersTable`, `EditUserDialog` |
| `posts` | `CreatePostForm`, `PostsList`, `EditPostDialog` |
| `roles` | `CreateRoleForm`, `RolesList`, `EditRoleDialog` |
| `permissions` | `CreatePermissionForm`, `PermissionsTable` |
| `role-permissions` | `RolePermissionMutationForm`, `RolePermissionsAssignmentsTable` |
| `sessions` | `AllSessionsList`, `UserSessionsLookup`, `RevokeSessionForm`, `RevokeAllSessionsForm` |
| `audit-logs` | `AuditLogsPanel` |
| `migrations` | `MigrationsTable` |
| `auth` | `AuthMarketingCopy`, `AuthCredentialsForm` |
| `dashboard` | `DashboardStatsGrid`, `OperationalNotesPanel` |

## Shared and layout

- **`@/components/shared`**: `AccessDenied`, `AsyncQueryPanel` (loading/error/empty shell), `RecordCardActions` (edit/delete row on record cards)
- **`@/components/layout`**: `AppShell` (re-export only); internals: `AppSidebar`, `AppTopbar`, `navVisibility.ts`

## Page responsibilities (after refactor)

Each `pages/*Page.tsx` file:

1. Owns `useQuery` / `useMutation` / `useForm` for that route
2. Composes 2–4 feature components with props/callbacks
3. Renders `{confirmDialog}` where confirmations are used

`SessionsPage.tsx` still exports multiple route components (`AllSessionsPage`, etc.) as thin wrappers.

## How to add a new screen

1. Add API usage in existing `api/services.ts` (unchanged pattern).
2. Create `src/features/<name>/components/*.tsx` (presentational or self-contained list blocks).
3. Export public components from `src/features/<name>/index.ts`.
4. Add `src/pages/<Name>Page.tsx` orchestrator.
5. Register route in `components/layout/AppShell.tsx` and nav in `constants.ts` if needed.

## Verification

```bash
pnpm --dir client typecheck
pnpm --dir client lint
```

Manual smoke: login/register, dashboard stats, users/posts/roles CRUD, role-permissions, permissions, sessions sub-routes, audit logs fetch, migrations list.

See also: [09_component_delegation_file_map.md](./09_component_delegation_file_map.md)
