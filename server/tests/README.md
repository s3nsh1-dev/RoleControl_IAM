# Tests

This repository keeps its automated tests by suite version.

## Commands

Default suite:

```bash
pnpm test
```

Version-specific commands:

```bash
pnpm test:v1
pnpm test:v2
pnpm test:v3
pnpm test:v4
pnpm test:v5
```

## Version Layout

```text
tests/
  README.md
  support/
  v1-archive/
  v2-integration/
  v3-migrations/
  v4-rate-limits/
  v5-openapi/
```

Version roles:

- `v1-archive`
  - archived baseline suite
  - preserves the original 5-test integration logic
- `v2-integration`
  - current active integration regression suite
  - runs with a full schema reset before every test
  - covers auth misuse, RBAC denials, mutation flows, and audit-log payload checks
- `v3-migrations`
  - migration-focused verification
- `v4-rate-limits`
  - rate-limit-focused verification
- `v5-openapi`
  - OpenAPI contract verification

## Shared Support

Shared helpers live in:

- [tests/support/database.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/support/database.ts)
- [tests/support/http.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/support/http.ts)
- [tests/support/redis.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/support/redis.ts)

Current support coverage includes:

- full schema reset and RBAC reseed
- migration-based schema rebuild helpers
- direct user creation for setup
- session inspection plus direct revoke/expire helpers
- audit log count and full-entry inspection
- cookie-aware HTTP client with cookie override and cookie-clear behavior
- Redis cleanup helpers for limiter-state isolation

## Current Strategy

The main test strategy is integration-first:

- real Express app
- real PostgreSQL connection
- mounted `/api/...` routes
- no mocked controllers
- deterministic environment reset before each test where needed

History and recorded results live in:

- [docs/testing-history/README.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/testing-history/README.md)
