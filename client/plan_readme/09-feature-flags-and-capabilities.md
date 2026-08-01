# 9. Feature flags and capabilities — crash course + this project

If you have **never used feature flags**, start here with plain language, then see how this repo implements the **same UX goal** (show or hide features at runtime) using **backend-driven capabilities** instead of a third-party flag service.

---

## 9.1 What “feature flags” usually mean in the industry

In many products, a **feature flag** (or feature toggle) is a **runtime switch** controlled by:

- A hosted service (LaunchDarkly, Flagsmith, etc.), or
- Config / environment variables, or
- Database-backed toggles per tenant

The app asks: “Is feature X on for this user?” and renders UI accordingly. Flags can roll out gradually, A/B test, or kill-switch broken features **without redeploying**.

**Typical flow:**

```text
App → flag SDK or API → boolean / variant → UI branch
```

This project **does not** integrate an external flag SDK. It still **branches UI at runtime** using data from your own backend.

---

## 9.2 What this project does instead: capability-based gating

Here, “is this feature on?” is answered by: **does the current session include a given capability string?**

Capabilities are **coarse-grained permissions** the API attaches to the user (via roles and role-permission assignments on the server). The frontend receives a **flat list** of strings on **`GET /api/auth/me`** (inside the typed `AuthMeData` shape — see [12 — OpenAPI TypeScript contract](./12-openapi-typescript-contract.md)).

**Mental model:**

```text
Industry flag     →  “Is darkModeRollout enabled?”
This codebase       →  “Does the user have capability users.create?”
```

Same **outcome** for the UI (conditional render), different **source of truth** (your RBAC API vs a flag vendor).

---

## 9.3 Data path: from API to `can(...)`

1. **React Query** loads session data via `useAuthMe` — [`client/src/hooks/useAuth.ts`](../src/hooks/useAuth.ts).
2. **`useCapabilities`** wraps that query, builds a **`Set`** of capability strings for O(1) lookup, and exposes:

   ```ts
   can: (capability: CapabilityKey) => boolean
   ```

3. **`CapabilityKey`** is a **TypeScript union** derived from OpenAPI (`schemas.CapabilityKey`). If you typo a string, the compiler errors — you cannot `can("userz.create")` silently.

---

## 9.4 Where this is used in the UI

Pages call `const { can } = useCapabilities()` and branch:

- **Whole panels** — e.g. “Create user” form only if `can("users.create")`.
- **Row actions** — Edit / Delete buttons only if `users.update` / `users.delete`.
- **Table headers** — “Actions” column omitted if no action capabilities.

**Concrete example:** [`client/src/pages/UsersPage.tsx`](../src/pages/UsersPage.tsx) — search for `can(` to see patterns.

The backend remains authoritative: even if someone tampered with the UI, endpoints still enforce RBAC. The capability list is **UX**, not security.

---

## 9.5 Why capabilities instead of role names

**Anti-pattern:**

```tsx
if (user.role === "admin" || user.role === "super-admin") { ... }
```

Problems: role names multiply, differ per deployment, and the UI breaks when the backend adds a new role that should have the same powers.

**This project’s approach:**

```tsx
if (can("users.create")) { ... }
```

The server maps roles → permissions → capabilities. The UI only asks for **abilities**, not job titles.

More context: [04 — §4.4](./04-auth-routing-access-control.md#44-capability-based-access-control-feature-flags).

---

## 9.6 If you later add “real” feature flags

You can combine both: e.g. `can("posts.experimental")` from the backend **or** a vendor flag for a gradual rollout. Keep **security-sensitive** rules on the server; use vendor flags for **product experimentation** that is not security-critical.

---

## 9.7 Related docs

- [04 — Authentication, Routing & Access Control](./04-auth-routing-access-control.md)
- [07 — React Query](./07-react-query.md) — `useAuthMe` cache
- [12 — OpenAPI TypeScript contract](./12-openapi-typescript-contract.md) — `CapabilityKey`
- [11 — Separation of Concerns](./11-separation-of-concerns.md) — hooks vs pages
