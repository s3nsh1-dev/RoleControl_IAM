# Testing

This project keeps automated testing by suite version, with `v2` remaining the main regression suite.

Current commands:

```bash
pnpm test
pnpm test:v1
pnpm test:v2
pnpm test:v3
pnpm test:v4
pnpm test:v5
```

The scripts are defined in [package.json](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/package.json) and run Node's built-in test runner through `tsx`.

## Active Strategy

Current suite roles:

- `v2`: main integration regression suite
- `v3`: migration verification suite
- `v4`: rate-limit-specific verification suite
- `v5`: OpenAPI contract verification suite

Relevant files:

- [tests/README.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/README.md)
- [tests/v2-integration/index.test.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/v2-integration/index.test.ts)
- [tests/v3-migrations/index.test.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/v3-migrations/index.test.ts)
- [tests/v4-rate-limits/index.test.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/v4-rate-limits/index.test.ts)
- [tests/v5-openapi/index.test.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/v5-openapi/index.test.ts)
- [docs/testing-history/README.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/testing-history/README.md)

## Coverage Summary

`v2` currently covers:

- bootstrap registration lock
- invalid login failures
- refresh rotation and replay rejection
- revoked-session and expired-session refresh rejection
- logout idempotency and cookie clearing
- session-cap enforcement
- unauthenticated protected-route denial
- mounted user create/view/list/update flows
- self password change protection
- self-delete and delete-user hierarchy denials
- role create/list/update/delete
- role assign/revoke and duplicate assignment conflict
- permission create/list/delete and duplicate create conflict
- role-permission assign/list/revoke
- post create/read/list/update/delete
- create-on-behalf post flow and self-behalf guard
- admin-vs-super-admin post-delete guard
- audit-log payload verification for important mutation flows

`v3` currently covers:

- baseline migration schema creation from an empty database
- migration rerun idempotency
- RBAC seed idempotency after migrations
- bootstrap registration, login, session creation, audit logging, and protected access on the migrated schema

`v4` currently covers:

- global limiter enforcement on non-exempt routes
- auth-route exemptions from the global limiter
- limiter bucket separation by client IP
- fail-open behavior when Redis-side limiter checks degrade

`v5` currently covers:

- OpenAPI document generation
- presence of documented key routes
- presence of documented security schemes

## Execution Requirements

To run these suites successfully:

- PostgreSQL must be running and reachable from `.env`
- Redis must be running and reachable for rate-limit-related tests
- the configured database user must be allowed to drop and recreate the schema in disposable test environments
- `pnpm test` destroys and recreates the schema repeatedly through [prepareDatabase](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/db.setup.ts)
- `pnpm test:v3` rebuilds the schema through migrations and reseeds the RBAC reference data
- `pnpm test:v4` also depends on a working Redis-backed limiter path

These suites should run only against:

- a local development database
- or a dedicated disposable test database

They must not be pointed at shared or important data.

## Latest Verified Runs

Latest verified results recorded in canonical docs:

- `v2`: `2026-04-12`, `pnpm test`, `21 passed, 0 failed`
- `v3`: `2026-04-14`, `pnpm run test:v3`, `4 passed, 0 failed`
- `v4`: `2026-04-23`, `pnpm test:v4`, `5 passed, 0 failed`
- `v5`: `2026-04-23`, `pnpm test:v5`, `1 passed, 0 failed`

Official version history:

- [docs/testing-history/README.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/testing-history/README.md)

## CI Direction

Minimum useful future CI checks:

- `pnpm exec tsc --noEmit`
- `pnpm test:v2`
- `pnpm test:v3`
- `pnpm test:v4`
- `pnpm test:v5`
