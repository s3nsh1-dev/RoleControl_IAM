# RoleControl IAM API

Express + TypeScript backend for RoleControl IAM, built around production-minded RBAC patterns with:

- cookie-based auth
- DB-backed refresh sessions
- PostgreSQL migrations
- Redis-backed rate limiting
- audit logging for sensitive mutations
- ownership-aware authorization
- code-first OpenAPI docs

## Stack

- Node.js
- Express 5
- TypeScript
- PostgreSQL
- Redis
- Zod
- JWT
- bcrypt
- pnpm

## Quick Start

1. Install dependencies.

```bash
pnpm install
```

2. Create your environment file.

```bash
cp .env.example .env
```

3. Update `.env` with working PostgreSQL, Redis, and JWT values.

4. Build the schema from migrations and seed the RBAC reference data.

```bash
pnpm run migrate:up
pnpm run db:seed
```

5. Start the development server.

```bash
pnpm run dev
```

The app starts from [index.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/index.ts) and mounts the Express app from [src/app.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/app.ts).

## Current Capabilities

Core backend logic is implemented for:

- authentication login / refresh / logout
- bootstrap registration for the first super-admin
- users CRUD
- roles CRUD
- permissions CRUD
- user-role assignment and revoke
- role-permission assignment and revoke
- posts CRUD with ownership-aware rules
- DB-backed audit logging
- Redis-backed auth and global rate limiting
- OpenAPI document export and Swagger UI

## Public API Surface

Mounted routes:

- `/api/auth`
- `/api/users`
- `/api/roles`
- `/api/permissions`
- `/api/user-roles`
- `/api/role-permissions`
- `/api/posts`

Public contract conventions:

- path params use descriptive names such as `userId`, `postId`, `permissionId`, and `roleName`
- role mutation request bodies use `roleName`
- machine-readable API docs are available at `/api/openapi.json`
- Swagger UI is available at `/api/docs`

See:

- [docs/api.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/api.md)
- [docs/architecture.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/architecture.md)
- [docs/operations.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/operations.md)

## Important Operational Notes

- `pnpm run db:setup` is destructive. [src/config/db.setup.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/db.setup.ts) drops and recreates the schema and should stay limited to disposable local/test scenarios.
- Normal schema evolution should use `pnpm run migrate:up`.
- RBAC seed data is applied through `pnpm run db:seed`.
- Auth cookies are `httpOnly`, `sameSite: "strict"`, and `secure: true` in [src/others/constants.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/others/constants.ts). Plain local HTTP browser flows may not persist them.
- Redis is an active runtime dependency because login, refresh, and global API rate limits rely on it.
- Proxy-aware deployments should configure `TRUST_PROXY` correctly because request IP handling and secure-cookie behavior depend on it.

## Project Layout

```text
src/
  app.ts
  config/
  contracts/
  controllers/
  middleware/
  models/
  openapi/
  routes/
  types/
  utils/
```

High-level responsibilities:

- `config/`: DB, migration, seed, Redis, and hierarchy setup
- `contracts/`: request/response schemas and public DTO mappers
- `controllers/`: request handlers and transaction flow
- `middleware/`: auth, rate limits, not-found, and error mapping
- `openapi/`: generated document definition and export entrypoint
- `utils/`: shared helpers for JWTs, sessions, hashing, validation, audit writes, and rate-limit utilities

## Scripts

- `pnpm run dev`: run the app with `tsx watch`
- `pnpm run build`: compile TypeScript to `dist`
- `pnpm run start`: start the built output
- `pnpm run db:setup`: destructive schema reset for disposable environments
- `pnpm run db:seed`: insert roles, permissions, and role-permission mappings
- `pnpm run migrate:create -- name`: create a new SQL migration file
- `pnpm run migrate:up`: apply pending migrations
- `pnpm run migrate:down`: roll back the latest migration
- `pnpm run migrate:status`: show applied and pending migrations
- `pnpm run openapi:export`: write `openapi/openapi.json`
