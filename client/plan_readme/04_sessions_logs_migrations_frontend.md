# 04 — Audit Logs, Migrations & Sessions Frontend Implementation Plan

> **Scope**: Wire the three new backend feature-groups into the existing React client.
> Each step references the codebase file that establishes the pattern it must follow.

---

## 0. Pre-requisite: Regenerate the OpenAPI Client Schema

The generated `client/src/api/schema.ts` is **stale** — it was generated before `Session`, `AuditLog`, `Migration` schemas, the updated `PermissionResource` enum (`audit_log | session | migration`), and the new response envelopes were added to the server contracts.

### Action
```bash
# from server root — regenerate the OpenAPI JSON then re-run openapi-typescript
# (follow whatever npm script / pipeline was used to produce schema.ts last time)
```

Until `schema.ts` contains the new types (`Session`, `AuditLog`, `Migration`, updated `PermissionResource`, updated `CapabilityKey`), the type-alias layer in `types.ts` cannot reference them.

> **If regeneration is deferred**, define the types manually in `types.ts` (see Step 2-alt below). The manual types can be dropped once the schema is regenerated.

---

## 1. Backend Pre-requisite: Extend `CapabilityKey` + `toCapabilityKeys` Mapper

> **Files**: `server/src/contracts/api.contracts.ts` (line 49-73) and `server/src/contracts/api.mappers.ts` (line 4-25, 173-254)

The `CapabilityKey` enum and the `toCapabilityKeys` switch-map do **not** currently contain entries for the three new resource domains. Without these, the `/api/auth/me` endpoint will never return session/audit/migration capabilities, and the client `can()` helper will always return `false`.

### CapabilityKey additions (contracts + mappers)

| Backend permission (`action:resource`)  | CapabilityKey to add          | UI gating purpose                                   |
|----------------------------------------|-------------------------------|-----------------------------------------------------|
| `view:audit_log`                       | `"auditLogs.view"`           | Show the "Logs" tab + fetch button                  |
| `view:migration`                       | `"migrations.view"`          | Show the "Migrations" tab                           |
| `view:session`                         | `"sessions.view"`            | Show "Session List" + "User Sessions" sub-tabs      |
| `revoke:session`                       | `"sessions.revoke"`          | Show "Revoke Session" sub-tab                       |
| `delete:session`                       | `"sessions.delete"`          | Show "Revoke All" sub-tab                           |

### Changes required (server-side, done before client work)

#### `api.contracts.ts` — `CapabilityKeySchema` enum (line 49-73)
Add the 5 new entries to the `.enum([...])` array.

#### `api.mappers.ts` — `CapabilityKey` type (line 4-25)
Add the 5 new union members.

#### `api.mappers.ts` — `toCapabilityKeys` switch (line 184-247)
Add 5 new `case` branches:
```ts
case "view:audit_log":
  capabilitySet.add("auditLogs.view");
  break;
case "view:migration":
  capabilitySet.add("migrations.view");
  break;
case "view:session":
  capabilitySet.add("sessions.view");
  break;
case "revoke:session":
  capabilitySet.add("sessions.revoke");
  break;
case "delete:session":
  capabilitySet.add("sessions.delete");
  break;
```

#### `api.contracts.ts` — `PermissionResourceSchema` (line 45-47)
Already using `RESOURCES_LIST` which already contains `"audit_log" | "session" | "migration"` — no change needed.

---

## 2. Client Type Layer — `client/src/api/types.ts`

> **Pattern**: every API shape is a thin alias over `components['schemas']` (see existing `types.ts` line 1-68).

### If `schema.ts` has been regenerated

Add these aliases after line 18:

```ts
export type AuditLog       = Schemas['AuditLog']
export type Migration      = Schemas['Migration']
export type Session        = Schemas['Session']
```

Update the `permissionResources` array (line 62-67) to include the new resources:

```ts
export const permissionResources = [
  'permission',
  'role',
  'user',
  'post',
  'audit_log',
  'session',
  'migration',
] as const satisfies readonly PermissionResource[]
```

### 2-alt. If `schema.ts` has NOT been regenerated

Define manual types (to be replaced later):

```ts
// ---------- Manual types (remove after schema regeneration) ----------
export type AuditLog = {
  id: number
  actor_id: number | null
  actor_fullname: string | null
  action_type: PermissionAction
  resource_type: PermissionResource
  resource_id: number
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type Migration = {
  id: number
  name: string
  run_on: string
}

export type Session = {
  id: number
  user_id: number
  user_fullname: string
  expires_at: string
  revoked_at: string | null
  device_info: string | null
  is_active: boolean
  created_at: string
}
// ---------------------------------------------------------------------
```

Also update the `PermissionResource` manually (or widen the type if schema is not regenerated).

---

## 3. API Service Layer — `client/src/api/services.ts`

> **Pattern**: each domain gets a named export object (`usersApi`, `rolesApi`, etc.) with typed `request<>()` calls and `paginationParams()` for paginated endpoints (see `services.ts` line 27-212).

### Add three new service objects

```ts
// ─── Audit Logs ────────────────────────────────────────────────────────
export const auditLogsApi = {
  list: (query: PaginationQuery) =>
    request<{ auditLogs: AuditLog[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/audit-logs',
      ...paginationParams(query),
    }),
}

// ─── System / Migrations ───────────────────────────────────────────────
export const migrationsApi = {
  list: (query: PaginationQuery) =>
    request<{ migrations: Migration[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/system/migrations',
      ...paginationParams(query),
    }),
}

// ─── Sessions ──────────────────────────────────────────────────────────
export const sessionsApi = {
  list: (query: PaginationQuery) =>
    request<{ sessions: Session[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/sessions',
      ...paginationParams(query),
    }),

  listByUser: (userId: number, query: PaginationQuery) =>
    request<{ sessions: Session[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: `/api/users/${userId}/sessions`,
      ...paginationParams(query),
    }),

  revoke: (sessionId: number) =>
    request<{ session: Session }>({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/revoke`,
    }),

  revokeAllByUser: (userId: number) =>
    request<{ revokedCount: number }>({
      method: 'PUT',
      url: `/api/users/${userId}/sessions/revoke-all`,
    }),
}
```

### Import additions at top of `services.ts`
```ts
import type {
  // ... existing imports ...
  AuditLog,
  Migration,
  Session,
} from './types'
```

---

## 4. Query Keys — `client/src/constants.ts`

> **Pattern**: factory functions that return a typed, serialisable tuple (see `constants.ts` line 5-17).

### Add new query key factories

```ts
auditLogs: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
  ["audit-logs", { page, pageSize }] as const,

migrations: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
  ["migrations", { page, pageSize }] as const,

sessions: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
  ["sessions", { page, pageSize }] as const,

userSessions: (userId: number, page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
  ["user-sessions", userId, { page, pageSize }] as const,
```

### Add nav items (after existing entries)

```ts
import {
  // ... existing icons ...
  ScrollText,    // Logs
  Database,      // Migrations
  MonitorSmartphone, // Sessions
} from "lucide-react";

// add to navItems array:
{ to: "/logs", label: "Logs", icon: ScrollText },
{ to: "/migrations", label: "Migrations", icon: Database },
{ to: "/sessions", label: "Sessions", icon: MonitorSmartphone },
```

---

## 5. Validation Schemas — `client/src/validation/schemas.ts`

> **Pattern**: Zod schemas with inferred types for every form (see `schemas.ts`).

The Sessions page has two ID-input sub-tabs (User Sessions lookup, Revoke Session, Revoke All). Add:

```ts
// Reuse the existing requiredPositiveInteger helper (line 15-18)
export const sessionIdSchema = z.object({
  sessionId: requiredPositiveInteger,
})

export const userIdSchema = z.object({
  userId: requiredPositiveInteger,
})

export type SessionIdFormValues = z.infer<typeof sessionIdSchema>
export type UserIdFormValues = z.infer<typeof userIdSchema>
```

> `requiredPositiveInteger` is already defined at line 15, so reuse it.

---

## 6. Page Components

### 6A. `client/src/pages/AuditLogsPage.tsx` — [NEW]

> **Pattern**: `PermissionsPage.tsx` is the closest reference — single paginated list panel with `can()` gating.

**Unique behaviour**: The page does NOT auto-fetch on mount. It shows a "Fetch Logs" button. Only when pressed does it start the query.

#### Design
```
┌──────────────────────────────────────────────────┐
│ Panel: "Audit Logs"                              │
│ desc: "User action history."                     │
│                                                  │
│  [ Fetch Logs ]    ← Button (primary)            │
│                                                  │
│  (after click → table with pagination)           │
│  ID | Actor | Action | Resource | Resource ID    │
│     | Old Values | New Values | Metadata | Date  │
└──────────────────────────────────────────────────┘
```

#### Key implementation details
- Gate entire page content with `can("auditLogs.view")` — if false, show `<EmptyState>Access denied</EmptyState>`.
- Use `useQuery` with `enabled: false` initially. Toggle to `true` via local `useState<boolean>` when button is clicked.
  ```ts
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const auditLogs = useQuery({
    queryKey: queryKeys.auditLogs(page),
    queryFn: () => auditLogsApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: fetchEnabled,
  });
  ```
- When `fetchEnabled` becomes `true`, show the skeleton/error/table as per existing pattern.
- `old_values`, `new_values`, `metadata` are JSON blobs — render them as `<pre>{JSON.stringify(val, null, 2)}</pre>` inside a `<td>` with `max-width` and `overflow: auto`. OR show a truncated badge that expands on click (simpler approach: just stringify truncated).
- Use existing components: `Panel`, `PaginationControls`, `Button`, `SkeletonRows`, `EmptyState`, `Badge`, `QueryErrorState`.

---

### 6B. `client/src/pages/MigrationsPage.tsx` — [NEW]

> **Pattern**: simplest possible list page — similar shape to `PermissionsPage` but read-only (no create/delete forms).

#### Design
```
┌──────────────────────────────────────────────────┐
│ Panel: "Migrations"                              │
│ desc: "Database migration history."              │
│                                                  │
│  ID | Migration Name | Run On                    │
│  ── | ────────────── | ──────                    │
│  12 | 00012_add_...  | May 14, 2026, 10:00 AM    │
│  …                                               │
│  ─── Pagination ───                              │
└──────────────────────────────────────────────────┘
```

#### Key implementation details
- Gate: `can("migrations.view")` — else `<EmptyState>Access denied</EmptyState>`.
- Auto-fetch on mount (standard `useQuery` with `enabled: true` — same as every other list page).
- Read-only — no mutations, no confirm dialogs.
- Use `formatDate()` for the `run_on` column.
- Minimal columns: ID, Name, Run On.

---

### 6C. `client/src/pages/SessionsPage.tsx` — [NEW]

> **Pattern**: closest to `UsersPage.tsx` — multiple panels gated by different capabilities, mutations with confirm dialogs.

This is the most complex page. It has **4 sub-sections** organised as a segmented control (tabs), each conditionally rendered based on capabilities.

#### Sub-tab visibility rules

| Sub-tab           | Alias              | Required capability   | Contains          |
|-------------------|--------------------|----------------------|-------------------|
| Session List      | "All Sessions"     | `sessions.view`      | Paginated table   |
| User Sessions     | "User Sessions"    | `sessions.view`      | ID input + table  |
| Revoke Session    | "Revoke"           | `sessions.revoke`    | ID input + action |
| Revoke All        | "Revoke All"       | `sessions.delete`    | ID input + action |

#### Design
```
┌──────────────────────────────────────────────────┐
│ Panel: "Sessions"                                │
│ desc: "Manage active user sessions."             │
│                                                  │
│ ┌────────────┬──────────────┬────────┬───────────┐
│ │ All        │ User         │ Revoke │ Revoke All│  ← segmented (CSS class already exists)
│ │ Sessions   │ Sessions     │        │           │
│ └────────────┴──────────────┴────────┴───────────┘
│                                                  │
│ [Active sub-tab content here]                    │
└──────────────────────────────────────────────────┘
```

#### Sub-tab: "All Sessions" (`sessions.view`)
- Standard paginated table auto-fetched on mount.
- Columns: ID | User ID | User Name | Device | Status (active/revoked/expired badge) | Expires At | Created At
- `is_active` → green Badge "ACTIVE", otherwise red-ish "INACTIVE".

#### Sub-tab: "User Sessions" (`sessions.view`)
- `<Field>` for User ID input (validated by `userIdSchema`).
- "Fetch" button → calls `sessionsApi.listByUser(userId, query)`.
- Uses `enabled: false` pattern (same as audit logs) — only fetches on form submit.
- Shows paginated results table identical to "All Sessions".

#### Sub-tab: "Revoke Session" (`sessions.revoke`)
- `<Field>` for Session ID input (validated by `sessionIdSchema`).
- "Revoke" button (danger variant) → opens `useConfirmAction` dialog.
- On confirm → calls `sessionsApi.revoke(sessionId)`.
- On success → toast + invalidate `["sessions"]` + `["user-sessions"]` query keys.

#### Sub-tab: "Revoke All" (`sessions.delete`)
- `<Field>` for User ID input (validated by `userIdSchema`).
- "Revoke All Sessions" button (danger variant) → opens `useConfirmAction` dialog.
- On confirm → calls `sessionsApi.revokeAllByUser(userId)`.
- On success → toast showing `revokedCount` + invalidate queries.

#### State management
```ts
const tabs = useMemo(() => {
  const available: { key: string; label: string }[] = [];
  if (can("sessions.view"))    available.push({ key: "list", label: "All Sessions" });
  if (can("sessions.view"))    available.push({ key: "user", label: "User Sessions" });
  if (can("sessions.revoke"))  available.push({ key: "revoke", label: "Revoke" });
  if (can("sessions.delete"))  available.push({ key: "revokeAll", label: "Revoke All" });
  return available;
}, [can]);

const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "list");
```

Render each sub-tab content conditionally based on `activeTab`.

---

## 7. Routing — `client/src/components/AppShell.tsx`

> **Pattern**: add `<Route>` entries alongside existing ones (line 92-100).

### Imports
```ts
import { AuditLogsPage } from "../pages/AuditLogsPage";
import { MigrationsPage } from "../pages/MigrationsPage";
import { SessionsPage } from "../pages/SessionsPage";
```

### Routes (inside `<Routes>`, before the catch-all)
```tsx
<Route path="/logs" element={<AuditLogsPage />} />
<Route path="/migrations" element={<MigrationsPage />} />
<Route path="/sessions" element={<SessionsPage />} />
```

---

## 8. CSS — `client/src/index.css`

> **Pattern**: use existing brutalist design tokens and component classes. Only add what's truly new.

### New CSS needed

```css
/* ─── Segmented Control (extend for N tabs) ────────────────────────── */
.segmented-dynamic {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  border: var(--border-width) solid var(--border);
  background: var(--segmented-bg);
}

.segmented-dynamic button {
  min-height: 48px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  transition: all 0s;
}

.segmented-dynamic button:hover {
  background: var(--segmented-btn-hover);
}

.segmented-dynamic button.active {
  background: var(--primary);
  color: var(--primary-text);
  border: var(--border-width) solid var(--border);
  margin: -2px;
  z-index: 1;
}

/* ─── JSON/Metadata Preview ─────────────────────────────────────────── */
.json-preview {
  max-width: 300px;
  max-height: 120px;
  overflow: auto;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  padding: 8px;
  margin: 0;
}

/* ─── Status Badges ─────────────────────────────────────────────────── */
.badge-active {
  background: var(--accent);
  color: var(--accent-text);
}

.badge-inactive {
  background: var(--danger-soft);
  color: var(--danger);
}
```

> The existing `.segmented` class forces exactly `grid-template-columns: repeat(2, 1fr)` (for the auth page). The new `.segmented-dynamic` variant uses `repeat(auto-fit, …)` so it scales to 2-4 tabs based on permissions.

---

## 9. File Summary

### Files to MODIFY

| File | What changes |
|------|-------------|
| `server/src/contracts/api.contracts.ts` | Add 5 CapabilityKey enum values |
| `server/src/contracts/api.mappers.ts` | Add 5 CapabilityKey type members + 5 switch cases |
| `client/src/api/schema.ts` | Regenerate (or leave stale, use manual types) |
| `client/src/api/types.ts` | Add `AuditLog`, `Migration`, `Session` aliases; update `permissionResources` |
| `client/src/api/services.ts` | Add `auditLogsApi`, `migrationsApi`, `sessionsApi` |
| `client/src/constants.ts` | Add query keys + nav items with icons |
| `client/src/validation/schemas.ts` | Add `sessionIdSchema`, `userIdSchema` + inferred types |
| `client/src/components/AppShell.tsx` | Add 3 `<Route>` entries + imports |
| `client/src/index.css` | Add `.segmented-dynamic`, `.json-preview`, `.badge-active`, `.badge-inactive` |

### Files to CREATE

| File | Purpose |
|------|---------|
| `client/src/pages/AuditLogsPage.tsx` | Logs tab — manual fetch + paginated table |
| `client/src/pages/MigrationsPage.tsx` | Migrations tab — auto-fetch read-only list |
| `client/src/pages/SessionsPage.tsx` | Sessions tab — 4 sub-tabs with view/revoke/delete |

---

## 10. Execution Order

The dependency graph dictates this order:

```
1.  Server: CapabilityKey + toCapabilityKeys (contracts + mappers)
2.  Client: Regenerate schema.ts (or skip and use manual types)
3.  Client: types.ts (new type aliases + updated permissionResources)
4.  Client: services.ts (3 new API service objects)
5.  Client: constants.ts (query keys + nav items)
6.  Client: validation/schemas.ts (2 new form schemas)
7.  Client: index.css (new CSS classes)
8.  Client: AuditLogsPage.tsx (simplest page)
9.  Client: MigrationsPage.tsx (simplest page)
10. Client: SessionsPage.tsx (most complex page)
11. Client: AppShell.tsx (routing + imports)
12. Verify: Run `pnpm dev` and test each tab
```

---

## 11. Verification Checklist

- [ ] `pnpm dev` builds without type errors
- [ ] Sidebar shows Logs, Migrations, Sessions links
- [ ] Logs tab: shows fetch button, clicking loads paginated logs with JSON previews
- [ ] Migrations tab: auto-loads migration history table
- [ ] Sessions tab: segmented control shows only allowed sub-tabs based on role
- [ ] "All Sessions": paginated table with active/inactive badges
- [ ] "User Sessions": user ID input → fetch → paginated results
- [ ] "Revoke": session ID input → confirm dialog → toast
- [ ] "Revoke All": user ID input → confirm dialog → toast with count
- [ ] 403 responses handled gracefully (tab hidden, not blank error)
- [ ] Pagination works correctly on all list endpoints
- [ ] Cache invalidation works after revoke mutations
