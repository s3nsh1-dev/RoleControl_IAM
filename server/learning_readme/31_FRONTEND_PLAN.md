# Comprehensive Frontend Implementation Plan

Welcome to the frontend implementation guide for RoleControl IAM. This document is designed to guide a frontend engineer (or an LLM assisting one) in building a production-grade, highly secure, and visually premium frontend. It translates the backend architecture and documentation into actionable frontend patterns.

This guide is broken down into two main parts:
1. **Understanding the Backend System Design & Choices**
2. **The Frontend Architecture & System Design for a Production-Grade UI**

---

## Part 1: Explaining the System Design to the Frontend and the Choices

To interact with the backend effectively, it is critical to understand *how* it handles data, security, and responses. The backend enforces a strict separation of concerns, heavily relying on the database and HTTP-only cookies for security.

### 1. The Authentication Model (Cookie-Based)
**The Design Choice:** The backend does **not** send JSON Web Tokens (JWTs) in the response body. It uses a highly secure, HTTP-only cookie system to prevent Cross-Site Scripting (XSS) attacks. 
- **Login (`POST /api/auth/login`)**: Validates credentials and sets `access` and `refresh` cookies directly in the browser. The JSON response contains user data, but no tokens.
- **Session Limits**: The backend enforces a strict session cap of **2 active sessions per user**. If a user logs in on a third device, the oldest session is automatically revoked.
- **Frontend Action**: The frontend never stores tokens in `localStorage`. You must configure your HTTP client (e.g., Axios) with `withCredentials: true` so the browser automatically attaches cookies to every request.
- **Token Refresh (`GET /api/auth/refresh`)**: Access tokens are short-lived. When a protected API call returns `401 Unauthorized`, the frontend must seamlessly call the refresh endpoint to get a new access cookie, and then retry the failed request. The refresh endpoint relies entirely on the presence of a valid `refresh` cookie.
- **Logout (`POST /api/auth/logout`)**: Revokes the session in the database and clears the cookies.
- **Registration (`POST /api/auth/register`)**: This is strictly reserved for the **first-time bootstrap** of the initial `super-admin`. Once a super-admin exists, this endpoint is permanently locked. The frontend should handle this by checking if registration is locked and hiding the registration UI accordingly.

### 2. Authorization & Role-Based Access Control (RBAC)
**The Design Choice:** The backend is the ultimate enforcer of security. It dynamically calculates user permissions at the database level using a strict hierarchy (`super-admin` > `admin` > `editor` > `user`).
- **Data Flow**: When you hit a protected route under `/api`, the backend reads the `access` cookie, gets the User ID, and checks the database for the user's effective permissions. `ROLE_RANKS` dictate administrative boundaries (e.g., an `admin` cannot modify a `super-admin`).
- **Audit Logging**: Sensitive mutations (like assigning roles or changing permissions) are strictly audited and recorded in the database within the same transaction. Ensure the frontend confirms intent before making destructive or sensitive changes.
- **Frontend Action**: The frontend will receive the user's assigned roles during login. **The frontend should use these roles purely for UX purposes** (e.g., hiding a "Delete Post" button if the user isn't an admin). Never rely on the frontend for actual security; the backend will block unauthorized actions with a `403 Forbidden` regardless of what the UI shows.

### 3. API Contract Standardization
**The Design Choice:** The backend uses a strict **Contract Layer**. It intentionally shapes the public API and never leaks raw database rows. All routes are mounted under the `/api` base path.
- **Success Pattern**: `{ success: true, message: "...", data: { ... }, timestamp: "..." }`
- **Error Pattern**: `{ success: false, status: "error", message: "...", details: [...], trace: "..." }`
- **Frontend Action**: The frontend API client should automatically unwrap the `data` object for success responses. The objects inside `data` will perfectly map to the predefined DTOs (Data Transfer Objects) found in the OpenAPI spec.

### 4. Global Rate Limiting
**The Design Choice:** The backend uses Redis-backed sliding-window rate limiters across the application, especially on authentication routes.
- **Frontend Action**: If the frontend makes too many requests too quickly, the backend will return a `429 Too Many Requests` error with a `Retry-After` header. The frontend must handle this gracefully, pausing requests and showing a user-friendly warning toast.

---

## Part 2: The System Design for a Production-Grade Frontend

To build a "production-grade" frontend, the architecture must prioritize type safety, robust state management, resilient API handling, and a premium user experience.

### 1. Recommended Technology Stack
Keep the stack modern and strongly typed:
- **Framework**: **Next.js (App Router)** or **Vite + React**. 
- **Language**: **TypeScript**. Types must be auto-generated from the backend's OpenAPI specification (`/api/openapi.json`).
- **Data Fetching & Caching**: **React Query (`@tanstack/react-query`)**. Essential for handling pagination, caching, loading states, and optimistic UI updates without complex local state.
- **State Management**: **Zustand**. Keep global state minimal (only store the User session and UI themes).
- **HTTP Client**: **Axios**. Necessary for its powerful interceptor capabilities.
- **Styling & UI Components**: **Tailwind CSS** paired with **shadcn/ui** or **Radix UI**. This ensures accessible, unstyled primitives that can be customized for a premium look.

### 2. The Core Architecture: Axios Interceptor Engine
The most critical part of the frontend system is the API engine. It must handle the cookie lifecycle silently so UI components don't have to worry about token expiration.

**Implementation Flow:**
1. Create an Axios instance with `baseURL: '/api'` and `withCredentials: true`.
2. Add a **Response Interceptor**:
   - **On Success (`2xx`)**: Intercept the response, unwrap the standard envelope, and return `response.data.data` to the React Query hooks.
   - **On `401 Unauthorized`**:
     - Check if the original request was *not* the `/login` or `/refresh` route.
     - Pause all incoming Axios requests.
     - Dispatch a background call to `GET /api/auth/refresh`.
     - **If successful**: Release the paused requests and retry the original failed request with the new cookie.
     - **If failed**: Wipe the Zustand auth store and hard redirect the user to `/login`.
   - **On `429 Too Many Requests`**: Trigger a global Toast notification alerting the user to slow down, respecting the `Retry-After` header.

### 3. Type Safety via OpenAPI & Interactive Docs
Do not manually type backend responses. The backend provides a rich, authoritative machine-readable contract.
- Use the interactive Swagger documentation available at `/api/docs` to understand endpoint behaviors and required parameters.
- Notice that path parameters use descriptive naming (e.g., `userId`, `roleName`, `permissionId`). Your frontend routing and API calls should mirror this clarity.
- Use a library like `openapi-typescript` to generate a `schema.d.ts` file directly from `/api/openapi.json`.
- Create domain-specific API service files (e.g., `services/roles.ts`) that utilize these generated types for request bodies and return types. React Query hooks will inherit these strict types.

### 4. UI/UX: Achieving a Premium Aesthetic
A production-grade app must feel dynamic and responsive. A generic MVP look is unacceptable.
- **Avoid Generic Spinners**: Use **Skeleton Loaders** for all data grids, tables, and lists while React Query is in the `isLoading` state.
- **Optimistic Updates**: When a user performs an action (e.g., creating a post or changing a role), update the UI instantly via React Query's `onMutate` cache manipulation. If the backend fails, roll back the cache automatically.
- **Micro-Animations**: Utilize **Framer Motion** or Tailwind's built-in transition utilities for button hovers, modal mounts, and dropdowns. The interface should feel alive.
- **Global Toast System**: Use a library like `sonner` or `react-hot-toast`. Every backend mutation (success or fail) must result in a beautifully designed toast notification utilizing the backend's `message` field. Be especially careful to require confirmation before firing mutations that will trigger backend `audit_logs` (e.g., permission changes).
- **Design System**: Use curated color palettes (e.g., Tailwind's `zinc` or `slate` for sleek dark modes), subtle glassmorphism effects, and modern typography (e.g., Inter or Roboto).

### 5. Recommended Directory Structure
Use a domain-driven feature folder structure to keep the codebase scalable:

```text
src/
├── api/             # Axios instance, interceptors, and openapi-typescript generated schemas
├── assets/          # Static assets, fonts, icons
├── components/      # Reusable UI library
│   ├── ui/          # Base components (Buttons, Inputs, Modals - via shadcn/ui)
│   ├── layout/      # Navbar, Sidebar, Dashboard Shell
│   └── guards/      # Route (<ProtectedRoute>) and Permission (<RoleGuard>) wrappers
├── features/        # Domain-driven feature modules
│   ├── auth/        # Login/Register forms, auth-specific API hooks
│   ├── users/       # User tables, creation forms, user-specific hooks
│   ├── roles/       # Role & Permission management grids
│   └── posts/       # Post feeds, creation modals
├── hooks/           # Global custom hooks (e.g., useTheme)
├── store/           # Zustand stores (AuthStore: { user, roles, isAuthenticated })
├── types/           # Global type declarations augmenting OpenAPI types
├── utils/           # Helper functions (date formatting, tailwind class merging)
└── App.tsx / pages/ # Routing definitions
```

### Summary for the LLM / Developer
When implementing this frontend:
1. Setup the **Axios Interceptor** first. The app cannot function smoothly without automatic 401 retries.
2. Generate types from `openapi.json` immediately and consult `/api/docs` for endpoint behavior.
3. Build the UI using **shadcn/ui** components, ensuring every mutation is wrapped in a React Query hook with optimistic updates and Toast notifications.
4. Use the `roles` array returned from the `/api/auth/login` endpoint solely to hide/show UI elements via a `<RoleGuard>` component wrapper. Rely on the backend to enforce the actual permissions.
