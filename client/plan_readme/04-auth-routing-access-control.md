# 4. Authentication, Routing & Access Control

## 4.1 Authentication Flow

The application uses **HTTP-only cookie-based authentication**. JWTs are **never stored** in `localStorage`, `sessionStorage`, or JavaScript memory. The backend sets and reads cookies directly.

### Login Flow
```
User submits email/password on AuthPage
        │
        ▼
authApi.login({ email, password })
        │
        ▼
Backend validates credentials, sets HTTP-only cookie
        │
        ▼
loginMutation.onSuccess:
  1. useAuthStore.setAuthenticated()     ← sets Zustand flag
  2. queryClient.fetchQuery(authMe)      ← eagerly fetches user profile
  3. navigate("/dashboard")              ← redirects to protected area
```

### Session Validation on Page Reload
```
User refreshes page or navigates directly to /dashboard
        │
        ▼
ProtectedRoute renders
        │
        ▼
useAuthMe() fires GET /api/auth/me (cookie is attached automatically)
        │
        ├── Loading → Show <SkeletonRows> (not a blank screen)
        │
        ├── Success → setAuthenticated(), render children (AppShell)
        │
        └── Error → Zustand isAuthenticated=false → <Navigate to="/login">
```

### Logout Flow
```
User clicks Logout button
        │
        ▼
authApi.logout() (POST /api/auth/logout — backend clears the cookie)
        │
        ▼
onSettled:
  1. clearAuth()           ← reset Zustand
  2. queryClient.clear()   ← wipe ALL cached data
  3. navigate("/login")    ← redirect
```

---

## 4.2 Routing Architecture

**File:** `src/App.tsx`

The top-level route structure:
```tsx
<Routes>
  <Route path="/login" element={<AuthPage />} />
  <Route path="/register" element={<AuthPage mode="register" />} />
  <Route path="/*" element={
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  } />
</Routes>
```

**Key design decisions:**

1. **AuthPage is reusable**: Login and registration share the same component. The `mode` prop switches between the two forms. Internally, a `segmented` control lets the user toggle without navigating.

2. **Catch-all protected route**: `path="/*"` catches every URL that isn't `/login` or `/register` and funnels it through the `ProtectedRoute` guard.

3. **Nested routing in AppShell**: The `AppShell` component defines its own nested `<Routes>` for the authenticated pages (`/dashboard`, `/users`, `/roles`, etc.). This keeps the top-level `App.tsx` clean.

### AppShell Internal Routes
```tsx
// src/components/AppShell.tsx
<Routes>
  <Route index element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/users" element={<UsersPage />} />
  <Route path="/roles" element={<RolesPage />} />
  <Route path="/permissions" element={<PermissionsPage />} />
  <Route path="/role-permissions" element={<RolePermissionsPage />} />
  <Route path="/posts" element={<PostsPage />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

Unknown paths redirect to `/dashboard` rather than showing a 404.

---

## 4.3 The ProtectedRoute Guard

**File:** `src/components/ProtectedRoute.tsx`

This component implements a three-state guard:

| Condition | Render |
|---|---|
| `authMe.isLoading` | `<SkeletonRows>` — loading indicator while session is validated |
| `!isAuthenticated && !authMe.data` | `<Navigate to="/login">` — redirect unauthenticated users |
| Otherwise | `children` — render the protected content |

It also **synchronizes Zustand with server reality**:
```ts
useEffect(() => {
  if (authMe.data) {
    setAuthenticated();  // keep Zustand in sync if the server confirms the session
  }
}, [authMe.data, setAuthenticated]);
```

---

## 4.4 Capability-Based Access Control (Feature Flags)

### What are capabilities?
The backend returns a flat array of capability strings with the `/auth/me` response:
```json
{
  "user": { "id": 1, "fullname": "Admin", "email": "admin@example.com" },
  "roles": ["super-admin"],
  "capabilities": ["users.create", "users.update", "users.delete", "roles.create", ...]
}
```

### The useCapabilities hook
**File:** `src/hooks/useAuth.ts`

```ts
export function useCapabilities() {
  const authMe = useAuthMe();
  const capabilitySet = useMemo(
    () => new Set(authMe.data?.capabilities ?? []),
    [authMe.data?.capabilities],
  );
  return {
    authMe,
    can: (capability: CapabilityKey) => capabilitySet.has(capability),
  };
}
```

**Design notes:**
- Capabilities are stored in a `Set` for O(1) lookups.
- The `Set` is memoized with `useMemo` so it's not recreated on every render.
- `CapabilityKey` is a **union type** derived from the OpenAPI schema, so TypeScript will error if you check for a capability that doesn't exist.

### How it's used in pages
```tsx
const { can } = useCapabilities();

// Entire panels are conditionally rendered
{can("users.create") ? (
  <Panel title="Create user">
    {/* form */}
  </Panel>
) : null}

// Individual buttons within a row
{can("users.update") ? <Button>Edit</Button> : null}
{can("users.delete") ? <Button variant="danger">Delete</Button> : null}

// Table columns are conditionally added
{can("users.update") || can("users.delete") ? <th>Actions</th> : null}
```

### Why capabilities instead of roles?
```
❌  if (user.role === "admin" || user.role === "super-admin")
✅  if (can("users.create"))
```

The first approach hardcodes role names into the UI. If the backend later creates a "moderator" role that can also create users, you must update every UI check. The capability approach requires zero frontend changes — the backend simply assigns the `users.create` capability to the new role.

---

## 4.5 Navigation Configuration

**File:** `src/constants.ts`

Navigation items are defined as a data array, not hardcoded JSX:
```ts
export const navItems = [
  { to: "/dashboard",        label: "Dashboard",        icon: Gauge },
  { to: "/users",            label: "Users",            icon: Users },
  { to: "/roles",            label: "Roles",            icon: ShieldCheck },
  { to: "/permissions",      label: "Permissions",      icon: KeyRound },
  { to: "/role-permissions", label: "Role permissions",  icon: Layers3 },
  { to: "/posts",            label: "Posts",            icon: FileText },
];
```

The `AppShell` sidebar renders this array dynamically using React Router's `<NavLink>`, which automatically applies an `active` CSS class to the current route.
