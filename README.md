# RoleControl IAM Project Structure

This repository contains RoleControl IAM: an Express + TypeScript RBAC API backed by PostgreSQL and Redis, plus a Vite + React frontend client for operating the API.

## Top-Level Structure

```text
.
├── README.md
├── client/
│   ├── README.md
│   ├── index.html
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vite.config.ts
│   ├── public/
│   └── src/
└── server/
    ├── README.md
    ├── index.ts
    ├── package.json
    ├── pnpm-lock.yaml
    ├── tsconfig.json
    ├── docs/
    ├── learning_readme/
    ├── migrations/
    ├── openapi/
    └── src/
```

## Folder And File Summary

### `client/`

Frontend application directory. It contains the Vite React dashboard for authenticating with the backend and managing users, roles, permissions, role-permission assignments, user-role assignments, and posts.

- `README.md`: frontend-specific setup notes, scripts, API proxy behavior, cookie-auth caveat, and folder summary.
- `index.html`: Vite HTML entrypoint.
- `package.json`: frontend dependencies and scripts.
- `pnpm-lock.yaml`: locked frontend dependency versions.
- `vite.config.ts`: Vite React/Tailwind config and local `/api` proxy to the backend.
- `public/`: static assets served directly by Vite.
- `src/`: frontend source code.

### `client/src/`

Primary frontend source code.

```text
client/src/
├── api/
├── components/
├── store/
├── utils/
├── App.tsx
├── index.css
└── main.tsx
```

- `api/`: generated OpenAPI types, Axios client, type aliases, and API service functions.
- `components/`: reusable UI primitives for forms, panels, buttons, badges, skeletons, and empty states.
- `store/`: Zustand auth store for user metadata and roles.
- `utils/`: formatting and class-name helpers.
- `App.tsx`: React Router routes, protected app shell, auth screen, and feature pages.
- `index.css`: global styling, layout rules, and responsive UI behavior.
- `main.tsx`: React entrypoint with router, query client, and toast provider.

### `server/`

Main backend application directory. It contains the Express API, database setup, migrations, OpenAPI contract, and project documentation.

- `README.md`: backend-specific setup notes, capabilities, API surface, scripts, and operational details.
- `index.ts`: backend entrypoint that starts the Express server.
- `package.json`: Node.js package metadata, dependencies, and npm/pnpm scripts.
- `pnpm-lock.yaml`: locked dependency versions for reproducible installs.
- `tsconfig.json`: TypeScript compiler configuration.

### `server/src/`

Primary application source code.

```text
server/src/
├── app.ts
├── config/
├── contracts/
├── controllers/
├── middleware/
├── models/
├── openapi/
├── others/
├── routes/
├── types/
└── utils/
```

- `app.ts`: creates and configures the Express app, middleware stack, routes, OpenAPI endpoints, and fallback handlers.
- `config/`: database, Redis, migration, seed, setup, and RBAC hierarchy configuration.
- `contracts/`: API request/response contract definitions and mapper functions for public response shapes.
- `controllers/`: route handler logic for auth, users, roles, permissions, role-permission assignment, user-role assignment, and posts.
- `middleware/`: shared Express middleware for cookie verification, error handling, not-found responses, and Redis-backed rate limiting.
- `models/`: database access modules for users, sessions, roles, permissions, role mappings, posts, and audit logs.
- `openapi/`: code-first OpenAPI document creation and export entrypoint.
- `others/`: shared constants.
- `routes/`: Express route definitions that connect URL paths to controller functions.
- `types/`: shared TypeScript types and Express request type augmentation.
- `utils/`: reusable helpers for errors, responses, async wrappers, JWTs, sessions, validation, hashing, environment values, and rate-limit utilities.

### `server/src/controllers/`

Controller modules are grouped by feature. The top-level controller files collect or expose feature handlers, while nested folders contain focused operations.

```text
server/src/controllers/
├── auth/
├── permission/
├── post/
├── role_permissions/
├── roles/
├── user_roles/
├── users/
├── auth.controller.ts
├── permission.controller.ts
├── post.controller.ts
├── role_permissions.controller.ts
├── roles.controller.ts
├── roles_permissions.controller.ts
├── user_roles.controller.ts
└── users.controller.ts
```

- `auth/`: login, logout, refresh-token, and registration handlers.
- `permission/`: create, list, and remove permission handlers.
- `post/`: create, read, update, delete, list, and create-on-behalf post handlers.
- `role_permissions/`: assign, revoke, and list role-permission relationship handlers.
- `roles/`: create, update, delete, and list role handlers.
- `user_roles/`: assign and revoke user-role relationship handlers.
- `users/`: create, view, update, delete, and list user handlers.

### `server/docs/`

Maintained project documentation.

- `api.md`: API behavior and endpoint documentation.
- `architecture.md`: backend architecture notes.
- `operations.md`: operational and deployment guidance.

### `server/learning_readme/`

Learning notes, implementation plans, design notes, and analysis documents created while developing the project. These files are useful for understanding why certain backend choices were made, but they are separate from the maintained docs in `server/docs/`.

### `server/migrations/`

SQL migration files for PostgreSQL schema changes.

- `202604130001_baseline-schema.sql`: baseline schema migration for the RBAC API.

### `server/openapi/`

Generated OpenAPI output.

- `openapi.json`: exported machine-readable API specification.

## Important Runtime Areas

- Auth is implemented through JWTs, HTTP-only cookies, and database-backed refresh sessions.
- Authorization is based on roles, permissions, role-permission mappings, and user-role mappings.
- PostgreSQL stores application data and audit logs.
- Redis is used by the rate-limiting middleware.
- OpenAPI docs are generated from `server/src/openapi/` and exported to `server/openapi/openapi.json`.
- Frontend API types are generated from `server/openapi/openapi.json` into `client/src/api/schema.ts`.
