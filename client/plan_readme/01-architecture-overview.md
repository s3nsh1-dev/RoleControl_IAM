# 1. Architecture Overview

## 1.1 What This Application Is

This is the frontend client for an **RBAC (Role-Based Access Control)** administration console built on top of a PostgreSQL-backed REST API. It is a **Single Page Application (SPA)** that uses **Client-Side Rendering (CSR)** — meaning the browser downloads a JavaScript bundle, and all routing, rendering, and data fetching happens in the browser after the initial page load.

The application allows authenticated operators to manage **Users**, **Roles**, **Permissions**, **Role-Permission assignments**, and **Posts** through a dashboard interface. Every UI action is gated by the user's backend-assigned capabilities.

---

## 1.2 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Build Tool | Vite | 8.x | Dev server, HMR, production bundling |
| UI Library | React | 19.x | Component rendering |
| Language | TypeScript | 5.9 | Static type safety |
| Routing | React Router DOM | 7.x | Client-side page navigation |
| Server State | TanStack React Query | 5.x | Data fetching, caching, background sync |
| Client State | Zustand | 5.x | Lightweight global state management |
| HTTP Client | Axios | 1.x | HTTP requests with interceptor middleware |
| Styling | TailwindCSS v4 + Vanilla CSS | 4.x | Design system and custom brutalist theme |
| Notifications | Sonner | 2.x | Toast notifications |
| Icons | Lucide React | 1.x | SVG icon components |
| Type Generation | openapi-typescript | 7.x | Auto-generate TS types from OpenAPI spec |
| Form Utilities | react-hook-form + zod | 7.x / 4.x | Form state management and validation (installed, partially used) |
| Class Merging | clsx + tailwind-merge | — | Conditional CSS class composition |

---

## 1.3 Design Principles

The codebase follows these core principles consistently:

### Separation of Concerns (SoC)
Every directory owns exactly one responsibility. Network logic never leaks into components. UI components never call APIs directly. Global state is isolated from page-level state.

### Contract-Driven Development
Frontend TypeScript types are **auto-generated** from the backend's OpenAPI JSON specification (`pnpm run generate:types`). The frontend never manually defines API shapes — they are derived from the single source of truth: the backend contract.

### Capability-Based Access Control
The UI does not check for role names (e.g., `if role === "admin"`). Instead, it checks for **granular capabilities** (e.g., `can("users.create")`). This decouples the UI from the role hierarchy and makes the system resilient to backend role changes.

### Server State vs. Client State
The codebase explicitly separates **server state** (data owned by the backend, managed via React Query) from **client state** (frontend-only flags like `isAuthenticated`, managed via Zustand). This avoids the common anti-pattern of mixing both into a single global store.

---

## 1.4 Directory Structure

```
client/
├── public/                    # Static assets served as-is
├── src/
│   ├── api/                   # Network layer
│   │   ├── client.ts          # Axios instance, interceptors, error class
│   │   ├── schema.ts          # Auto-generated OpenAPI types (DO NOT EDIT)
│   │   ├── services.ts        # Domain-grouped API service factories
│   │   └── types.ts           # Re-exported type aliases and enum arrays
│   ├── components/            # Reusable UI components
│   │   ├── AppShell.tsx       # Authenticated layout (sidebar + topbar + routes)
│   │   ├── PaginationControls.tsx  # Page navigation for lists
│   │   ├── ProtectedRoute.tsx # Auth guard wrapper
│   │   ├── ThemeToggle.tsx    # Dark/light mode switch
│   │   └── ui.tsx             # Primitive design components (Button, Field, Panel...)
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts         # Session query + capability checker
│   │   ├── useConfirmAction.tsx  # Destructive action confirmation dialog
│   │   └── useTheme.ts        # Theme persistence and DOM class toggling
│   ├── pages/                 # Route-level page components
│   │   ├── AuthPage.tsx       # Login / Bootstrap registration
│   │   ├── DashboardPage.tsx  # Stats overview
│   │   ├── UsersPage.tsx      # User CRUD + role assignment
│   │   ├── RolesPage.tsx      # Role CRUD
│   │   ├── PermissionsPage.tsx    # Permission CRUD
│   │   ├── RolePermissionsPage.tsx # Role-permission matrix
│   │   └── PostsPage.tsx      # Post CRUD + on-behalf creation
│   ├── store/                 # Global client-side state
│   │   └── auth.ts            # Zustand auth store with localStorage persistence
│   ├── utils/                 # Pure utility functions
│   │   ├── format.ts          # Date formatting + CSS class merging
│   │   └── rolePermissions.ts # Data grouping logic for permission matrix
│   ├── constants.ts           # Query keys, nav items, page size defaults
│   ├── App.tsx                # Top-level route definitions
│   ├── main.tsx               # React bootstrap + provider wrappers
│   └── index.css              # Complete design system (847 lines)
├── vite.config.ts             # Vite + Tailwind + dev proxy configuration
├── package.json
└── tsconfig.*.json
```

---

## 1.5 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│                                                                  │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────────┐  │
│  │  Pages   │───▶│  Hooks   │───▶│ Services │───▶│   Client   │  │
│  │ (Smart)  │    │(useAuth) │    │(usersApi)│    │  (Axios)   │──┼──▶ Backend API
│  └────┬─────┘    └──────────┘    └──────────┘    └──────┬─────┘  │
│       │                                                 │        │
│       ▼                                                 ▼        │
│  ┌─────────┐                                    ┌────────────┐   │
│  │   UI    │                                    │ Interceptor│   │
│  │(Button, │                                    │ (401 retry │   │
│  │ Panel)  │                                    │  429 toast)│   │
│  └─────────┘                                    └────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────┐    ┌──────────┐                                    │
│  │  Zustand │    │  React   │                                    │
│  │  Store   │    │  Query   │                                    │
│  │(auth flag)│   │ (cache)  │                                    │
│  └──────────┘    └──────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
```
