# Part 2: Frontend System Design for a Production-Grade UI

This document dictates the architectural decisions and patterns the frontend must follow to build a premium, maintainable, and robust interface that perfectly pairs with the RoleControl IAM API backend.

## 1. Technology Stack
To achieve a "production-grade" and wow-worthy aesthetic, the frontend should strictly use:
- **Framework**: **Next.js (App Router)** or **Vite + React**. 
- **Language**: **TypeScript**. Type definitions should be auto-generated from the backend's `openapi/openapi.json`.
- **State Management**: **Zustand** for global client state (e.g., Auth Session, Active Theme).
- **Data Fetching & Caching**: **React Query (@tanstack/react-query)** for handling API requests, caching, pagination, and optimistic updates.
- **Styling**: **Tailwind CSS** using a curated, non-generic color palette (e.g., slate/zinc dark modes, subtle glassmorphism) paired with a headless UI library like **shadcn/ui** or **Radix UI**.
- **HTTP Client**: **Axios**, configured with advanced interceptors.

## 2. Architectural Workflows & Implementation Rules

### A. The Axios Interceptor Engine (Critical)
The frontend MUST implement a centralized API client that handles the cookie lifecycle silently.
- **Setup**: Create an Axios instance with `withCredentials: true`.
- **Response Interceptor Logic**:
  1. If a response is `2xx`, unwrap the standard backend envelope and return `response.data.data`.
  2. If a response is `401 Unauthorized` (and the original request was not the `/login` or `/refresh` endpoint itself):
     - Pause all incoming API requests.
     - Dispatch a single background request to `/api/auth/refresh`.
     - If the refresh succeeds, release the paused requests and retry them.
     - If the refresh fails, wipe the Zustand auth state and redirect the user to the `/login` page.
  3. If a response is `429 Too Many Requests`, trigger a global toast notification alerting the user to slow down.

### B. Auto-Generated Types & API Services
Instead of manually typing API responses, the frontend must use the `openapi.json` file.
- Use a tool like `openapi-typescript` to generate a `schema.d.ts` file.
- Create domain-specific service files (e.g., `services/users.ts`) that export React Query hooks (`useGetUsers`, `useCreateUser`) strongly typed to the OpenAPI schemas.

### C. State Management & Route Guards
The Zustand store should hold the absolute minimum global state:
```typescript
interface AuthStore {
  user: UserSummary | null;
  roles: RoleName[];
  isAuthenticated: boolean;
  setAuth: (user: UserSummary, roles: RoleName[]) => void;
  clearAuth: () => void;
}
```
- **Protected Routes**: Implement a High-Order Component (HOC) or layout wrapper that checks `isAuthenticated`. If false, redirect to `/login`.
- **Permission Guards**: Create a `<Protect requiredRole="admin">` wrapper component that hides its children if the current user's role array does not satisfy the requirement.

### D. Premium UX & Aesthetic Guidelines
To ensure the UI is not just a "simple MVP" but a dynamic, wow-worthy application:
- **Never use generic spinners**: Implement Skeleton Loaders for data tables (Users, Roles) while React Query is in an `isLoading` state.
- **Optimistic UI Updates**: When a user changes a permission or creates a post, update the UI instantly via React Query's `onMutate` cache manipulation. Roll it back if the backend returns an error.
- **Micro-animations**: Use Framer Motion or Tailwind transitions on buttons (hover/active states), dropdowns, and modal mounts to make the interface feel alive.
- **Feedback**: Every backend mutation (Create, Update, Delete) must result in a beautifully designed Toast notification (using `sonner` or `react-hot-toast`) utilizing the backend's `message` field from the standard envelope.

## 3. Recommended Directory Structure
```text
src/
├── api/             # Axios instance, interceptors, and openapi-typescript definitions
├── assets/          # Static assets, fonts, icons
├── components/      # Reusable UI library
│   ├── ui/          # Base components (Buttons, Inputs, Modals - e.g., shadcn/ui)
│   ├── layout/      # Navbar, Sidebar, Dashboard Shell
│   └── guards/      # Route and Permission protection wrappers
├── features/        # Domain-driven feature modules
│   ├── auth/        # Login/Register components and API hooks
│   ├── users/       # User tables, creation forms, role assignment logic
│   ├── roles/       # Role & Permission management grids
│   └── posts/       # Post interactions
├── hooks/           # Global custom hooks (e.g., useHasPermission, useTheme)
├── store/           # Zustand stores (AuthStore, UIStore)
├── types/           # Global type declarations (mostly augmenting openapi types)
├── utils/           # Helper functions (date formatting, class merging for Tailwind)
└── App.tsx / pages/ # Routing definitions
```
