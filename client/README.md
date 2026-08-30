# Client-Side Frontend Architecture & Documentation

Welcome to the React client for RoleControl IAM. This document serves as a comprehensive developer guide, detailing the system design, architectural patterns, and the rationale behind our technological choices.

---

## Table of Contents

1. [Architecture & System Design](#1-architecture--system-design)
2. [State Management Strategy](#2-state-management-strategy)
3. [Network & API Layer (Axios)](#3-network--api-layer-axios)
4. [Feature Flags & Access Control (RBAC)](#4-feature-flags--access-control-rbac)
5. [UI & Component Design](#5-ui--component-design)
6. [Directory Structure](#6-directory-structure)
7. [Developer Setup & Scripts](#7-developer-setup--scripts)

---

## 1. Architecture & System Design

This project is structured as a **Single Page Application (SPA)** utilizing **Client-Side Rendering (CSR)**. 

### Core Design Principles
*   **Separation of Concerns (SoC):** Network logic, global state, presentation UI, and page routing are strictly isolated in dedicated directories.
*   **Service Layer Pattern:** React components never call endpoints directly. All API communication is abstracted behind service factories (e.g., `usersApi.list()`).
*   **Strong Typing (Contract-Driven):** Frontend types are not manually written; they are auto-generated directly from the backend's OpenAPI contract to guarantee API synchronicity.

---

## 2. State Management Strategy

Frontend state management is divided into three distinct categories to avoid the "global state soup" anti-pattern:

### A. Server State (Data Fetching & Caching)
*   **Technology:** `@tanstack/react-query`
*   **Why:** Server data is fundamentally different from client state. Native `useEffect` fetching lacks caching, deduplication, and retry logic. React Query treats the backend as the single source of truth and maintains a background-synchronized cache on the frontend, handling loading/error states out-of-the-box.
*   **Where:** Used in feature pages (`src/pages/*`) via `useQuery` (for reading) and `useMutation` (for writing).

### B. Global Application State
*   **Technology:** `zustand`
*   **Why:** For non-persistent, frontend-only state that spans multiple components. Zustand is a minimalist alternative to Redux that avoids complex boilerplate and React Context re-render cascades.
*   **Where:** `src/store/auth.ts`. We use Zustand's `persist` middleware to save the `isAuthenticated` boolean in `localStorage`. This acts as an immediate gatekeeper on page reload, preventing UI flicker before the background session validation completes.

### C. Local UI State
*   **Technology:** React `useState`
*   **Why:** Ephemeral data that belongs only to a single component (e.g., text typed into a search box, or a dropdown being open/closed).
*   **Where:** Used heavily in forms within `src/pages/` before submitting mutations to the backend.

---

## 3. Network & API Layer (Axios)

*   **Technology:** `axios`
*   **Where:** `src/api/client.ts`

### The Silent Refresh Interceptor
Instead of using the native `fetch` API, Axios is used primarily for its powerful **Interceptor** capabilities. 

Our application features a seamless JWT authentication flow:
1.  An API request is made.
2.  If the backend returns a `401 Unauthorized` (token expired), the Axios response interceptor pauses the original request.
3.  It automatically makes a background request to `/api/auth/refresh` to obtain a new token.
4.  Once refreshed, the original request is retried invisibly. The user experiences zero interruption.

### API Services
All API calls are grouped by domain in `src/api/services.ts`. If an endpoint URL changes (e.g., `/api/users` to `/api/v2/users`), you only need to update it in one central location, completely decoupling the UI from backend routing constraints.

---

## 4. Feature Flags & Access Control (RBAC)

**Terminology:** **Capability-Based Access Control** (a form of Feature Toggling).

*   **Technology:** Custom Hook (`src/hooks/useAuth.ts`)
*   **Why:** Instead of hardcoding UI logic based on broad roles (e.g., `if (user.role === 'admin')`), we evaluate specific capabilities (e.g., `if (can('users.create'))`). This ensures the UI is entirely scalable if business requirements change and non-admins are eventually granted permission to create users.
*   **Where:** Wraps sensitive UI elements and buttons.
    ```tsx
    const { can } = useCapabilities();
    
    {can("users.create") ? (
      <Button onClick={handleCreate}>Create User</Button>
    ) : null}
    ```

---

## 5. UI & Component Design

**Terminology:** **Dumb/Presentation Components** vs. **Smart/Container Components**.

*   **Presentation Components (`src/components/ui.tsx`):** These components (`Button`, `Field`, `Panel`) have zero business logic. They do not fetch data or read global state. They purely accept props and render styled HTML (via Tailwind CSS). This ensures design consistency across the application.
*   **Smart Components (`src/pages/*`):** These page-level components wire the application together. They fetch data via React Query, evaluate RBAC capabilities, manage local form state, and map data down to Presentation components.

---

## 6. Directory Structure

```text
src/
├── api/             # Network configuration, interceptors, and typed service factories
│   ├── client.ts    # Global Axios instance and interceptors
│   ├── schema.ts    # Auto-generated OpenAPI typings
│   ├── services.ts  # Domain-specific API function endpoints
│   └── types.ts     # Mapped interfaces for component usage
├── components/      # Dumb presentation components and layout wrappers
│   ├── AppShell.tsx # Main authenticated layout shell
│   └── ui.tsx       # Reusable primitives (Buttons, Inputs, Panels)
├── hooks/           # Reusable React hooks containing business logic (useAuth, useConfirmAction)
├── pages/           # Smart components representing application routes
├── store/           # Global Zustand state stores (auth.ts)
├── utils/           # Helper functions (date formatting, class merging)
├── App.tsx          # Application routing definitions
└── main.tsx         # React bootstrap and Provider wrappers
```

---

## 7. Developer Setup & Scripts

### Prerequisites
Ensure the backend server (`../server/`) is running before operating the client, as Vite will proxy all `/api/*` requests to `http://localhost:8000`.

### Commands

```bash
# Install dependencies
pnpm install

# Start local development server
pnpm run dev

# Generate TypeScript types from backend OpenAPI contract
pnpm run generate:types

# Run typechecking
pnpm run typecheck

# Lint codebase
pnpm run lint

# Build for production
pnpm run build
```

### Cookie Auth Note
The backend uses `HTTP-only` cookies, and the frontend never explicitly stores JWTs. Axios is configured with `withCredentials: true` to attach cookies to cross-origin or proxied requests automatically. Ensure your browser environment supports testing with secure cookies if authentication drops unexpectedly on `localhost`.
