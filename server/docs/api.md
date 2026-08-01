# API Surface

## Base Path

All routes are mounted under `/api`.

## Contract Notes

This file is the quick human-readable summary of the API surface.

The authoritative machine-readable contract is:

- `GET /api/openapi.json`

Interactive docs are available at:

- `GET /api/docs`

Public contract conventions:

- path params use descriptive names such as `userId`, `postId`, `permissionId`, and `roleName`
- role mutation request bodies use `roleName`
- success responses follow the app envelope shape and return named objects or collections in `data`

## Auth

Routes:

- `POST /api/auth/login`
- `GET /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/register`

Notes:

- login sets `access` and `refresh` cookies
- refresh depends on the `refresh` cookie, not on a valid access token
- logout revokes the session identified by the refresh token and clears cookies
- register is intended only for first-time bootstrap of the first super-admin

## Users

Routes:

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:userId`
- `PUT /api/users/:userId`
- `DELETE /api/users/:userId`

Body notes:

- create user accepts `roleName` for the initial role assignment

## Roles

Routes:

- `GET /api/roles`
- `POST /api/roles`
- `PUT /api/roles/:roleName`
- `DELETE /api/roles/:roleName`

## Permissions

Routes:

- `GET /api/permissions`
- `POST /api/permissions`
- `DELETE /api/permissions/:permissionId`

## User Roles

Routes:

- `POST /api/user-roles/:userId`
- `DELETE /api/user-roles/:userId`

Body notes:

- role assignment and revoke accept `roleName`

## Role Permissions

Routes:

- `GET /api/role-permissions`
- `POST /api/role-permissions`
- `DELETE /api/role-permissions`

Body notes:

- permission assignment and revoke accept:
  - `roleName`
  - `action`
  - `resource`

## Posts

Routes:

- `GET /api/posts`
- `POST /api/posts`
- `POST /api/posts/on-behalf/:userId`
- `GET /api/posts/:postId`
- `PUT /api/posts/:postId`
- `DELETE /api/posts/:postId`

## Authentication Requirement

Most non-auth routes are protected by [checkCookieSignature.middleware.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/middleware/checkCookieSignature.middleware.ts), which expects the `access` cookie.
