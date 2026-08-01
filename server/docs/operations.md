# Operations

## Environment

Environment variables are parsed in [src/utils/envHelper.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/utils/envHelper.ts).

Use `.env.example` as the starting point.

Required practical values:

- working PostgreSQL connection settings
- working Redis connection settings
- a non-placeholder `JWT_SECRET`

## Development Workflow

Install:

```bash
pnpm install
```

Apply migrations:

```bash
pnpm run migrate:up
```

Seed the reference RBAC data:

```bash
pnpm run db:seed
```

Start the app:

```bash
pnpm run dev
```

## Schema Management

The normal schema workflow is migration-based.

Use:

```bash
pnpm run migrate:up
pnpm run migrate:status
```

Relevant file:

- [src/config/db.migrate.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/db.migrate.ts)

## Destructive Reset Warning

[src/config/db.setup.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/db.setup.ts) drops the existing tables before recreating them.

That means `pnpm run db:setup` is safe only for:

- local development
- disposable environments
- explicit reset scenarios

It is not a normal production schema workflow.

## Seed Workflow

`pnpm run db:seed` inserts the reference RBAC data:

- roles
- permissions
- role-permission mappings

This is part of initial environment/bootstrap setup. It should not be treated as an every-release deploy step unless the target environment is intentionally being initialized or repaired.

## Redis And Rate Limiting

Redis is an active runtime dependency.

It is used for:

- login rate limiting
- refresh rate limiting
- global API rate limiting

Relevant files:

- [src/config/redis.connect.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/redis.connect.ts)
- [src/utils/rateLimit.util.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/utils/rateLimit.util.ts)

## Cookie Behavior

Auth cookies are set with:

- `httpOnly: true`
- `secure: true`
- `sameSite: "strict"`

Defined in [src/others/constants.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/others/constants.ts).

Implications:

- browsers may not store these cookies over plain local HTTP
- production deployments should expect HTTPS
- secure-cookie behavior must be understood together with proxy settings

## Proxy Behavior

The app reads `TRUST_PROXY` and applies it through Express in [src/app.ts](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/app.ts).

This matters for:

- trusted client IP detection
- rate limiting
- reverse-proxy deployments
- secure cookie handling

If the app is deployed behind Nginx or a platform/load-balancer proxy, `TRUST_PROXY` should match that topology.

## OpenAPI And Docs Exposure

The app now serves:

- `GET /api/openapi.json`
- `GET /api/docs`

The static spec can also be exported with:

```bash
pnpm run openapi:export
```

## Production Notes

Current production-minded capabilities already present in the repo:

- migration-based schema evolution
- Redis-backed rate limiting
- OpenAPI/Swagger contract exposure
- secure cookie defaults
- proxy-aware Express configuration

Still-valuable future operational improvements include:

- CI
- structured logging
- health/readiness endpoints
- containerization and deployment automation
