# Architecture

## Overview

This project is a modular Express backend with four main layers:

- routes register endpoint shapes
- controllers implement request handling and transaction flow
- middleware handles auth, rate limiting, and error mapping
- contracts/OpenAPI define the public request and response surface

PostgreSQL stores the authority data for users, roles, permissions, sessions, posts, and audits. Redis supports rate limiting.

## Core Domain Model

Main persisted tables:

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `posts`
- `user_sessions`
- `audit_logs`

Schema evolution is managed through migrations in [migrations/](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/migrations). The destructive setup helper exists for disposable resets, but migrations are the normal schema source of truth.

Relationship summary:

- users have many roles through `user_roles`
- roles have many permissions through `role_permissions`
- posts belong to a user through `owner_id`
- refresh sessions belong to a user through `user_sessions`
- audit rows capture mutation snapshots across resources

## Auth Model

Authentication is cookie-based and uses two JWTs:

- access token
- refresh token

Relevant files:

- [src/controllers/auth/login.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/controllers/auth/login.ts)
- [src/controllers/auth/refreshToken.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/controllers/auth/refreshToken.ts)
- [src/controllers/auth/logout.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/controllers/auth/logout.ts)
- [src/utils/jsonWebTokens.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/utils/jsonWebTokens.ts)
- [src/utils/session.util.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/utils/session.util.ts)

Flow:

1. Login validates user credentials.
2. A `user_sessions` row is created.
3. The refresh JWT carries `uId` and `sId`.
4. Refresh rotates the stored refresh-token hash for that session row.
5. Logout revokes the current session row by setting `revoked_at`.

Session cap:

- login enforces a maximum of 2 session rows per user
- when the cap would be exceeded, the oldest row is deleted first

## Authorization Model

Permission checks are database-driven.

Relevant files:

- [src/utils/helper.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/utils/helper.ts)
- [src/config/hierarchy.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/hierarchy.ts)

Important distinction:

- `checkRolePermissions(...)` reads effective permissions from the database
- `ROLE_RANKS` is used for runtime hierarchy checks such as admin vs super-admin management boundaries
- `PERMISSION_HIERARCHY` is a reference/seed helper, not the runtime authorization source of truth

## Request Pipeline

The runtime request path is shaped by:

- cookie parsing
- auth protection on mounted routers
- route-specific auth limiters
- global API limiting
- controller-level business rules
- error normalization through the error middleware

Relevant pieces:

- [src/middleware/checkCookieSignature.middleware.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/middleware/checkCookieSignature.middleware.ts)
- [src/middleware/loginRateLimiting.middleware.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/middleware/loginRateLimiting.middleware.ts)
- [src/middleware/refreshRateLimiting.middleware.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/middleware/refreshRateLimiting.middleware.ts)
- [src/middleware/globalRateLimiting.middleware.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/middleware/globalRateLimiting.middleware.ts)
- [src/middleware/errorHandler.middleware.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/middleware/errorHandler.middleware.ts)

## Contract Layer

The public API shape is defined intentionally instead of leaking raw DB rows.

Relevant files:

- [src/contracts/api.contracts.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/contracts/api.contracts.ts)
- [src/contracts/api.mappers.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/contracts/api.mappers.ts)

This layer owns:

- request body schemas
- path param schemas
- response DTO schemas
- success/error envelope shapes
- mapping from persistence-oriented rows to public API payloads

## OpenAPI Layer

The API contract is also exposed as a code-first OpenAPI document.

Relevant files:

- [src/openapi/document.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/openapi/document.ts)
- [src/openapi/export.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/openapi/export.ts)
- [openapi/openapi.json](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/openapi/openapi.json)

Runtime exposure:

- `/api/openapi.json`
- `/api/docs`

## Audit Logging

Sensitive mutations create rows in `audit_logs`.

Relevant helper:

- [auditDBMutation](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/utils/helper.ts)

Current pattern:

- perform the business mutation inside a transaction
- insert the audit row in the same transaction
- commit once both succeed

That keeps mutation state and audit state consistent.
