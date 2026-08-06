# Suggestions — Index

20 suggestions. Ranked out of 10 by **impact on maintainability, correctness and
deployability** — not urgency. A high-ranked suggestion is one where the payoff
compounds; a low-ranked one is worth doing but nothing depends on it.

These are not bugs. Several are alternative designs, and two of them are
**mutually exclusive with a vulnerability fix** — those are flagged.

---

## By rank

| # | Suggestion | Rank | Side | Effort |
|---|-----------|------|------|--------|
| [01](./01.centralize-authorization-in-middleware.md) | Move the coarse permission check into route middleware | **9** | Server | Medium |
| [02](./02.thread-transaction-client-through-helpers.md) | Replace transaction boilerplate with `withTransaction` | **8** | Server | Small |
| [03](./03.database-driven-role-hierarchy.md) | Move the role hierarchy into the database; unlock custom roles | **8** | Both | Medium-large |
| [15](./15.authorization-test-matrix.md) | Build an exhaustive role × endpoint authorization matrix | **8** | Both | Medium |
| [05](./05.postgres-and-redis-production-config.md) | Configure the pool and Redis client for production | **7** | Server | Small |
| [06](./06.structured-logging-and-request-ids.md) | Replace 40 `console.*` calls with structured logging | **7** | Server | Small-medium |
| [13](./13.environment-config-and-secret-management.md) | Split config by environment; stop defaulting secrets | **7** | Both | Small |
| [04](./04.service-layer-and-repositories.md) | Separate HTTP concerns from SQL | **6** | Server | Large |
| [07](./07.health-readiness-and-graceful-shutdown.md) | Real health/readiness endpoints; finish the shutdown | **6** | Server | Small |
| [10](./10.client-capability-guard-component.md) | Declarative `<Can>` guard instead of scattered ternaries | **6** | Client | Small |
| [14](./14.docker-compose-and-reproducible-dev-env.md) | Make the whole stack start with one command | **6** | Both | Medium |
| [16](./16.openapi-as-contract-source-of-truth.md) | Close the gaps between the contract and what is enforced | **6** | Both | Small-medium |
| [08](./08.single-validation-middleware.md) | Validate params, query and body in one middleware | **5** | Server | Small |
| [11](./11.react-query-cache-hardening.md) | Clear the cache reliably on logout and privilege change | **5** | Client | Small |
| [12](./12.axios-refresh-interceptor-correctness.md) | Tighten the refresh interceptor | **5** | Client | Small |
| [19](./19.session-cap-and-device-management.md) | Raise the 2-session cap; make eviction visible | **5** | Both | Small-medium |
| [09](./09.pagination-strategy.md) | Fix the `COUNT(*)` cost and offset drift | **4** | Both | Small |
| [17](./17.repository-hygiene-and-generated-artifacts.md) | Stop committing 243 generated coverage files | **4** | Both | Tiny |
| [18](./18.error-taxonomy-and-client-mapping.md) | Machine-readable error codes | **4** | Both | Small-medium |
| [20](./20.accessibility-and-dialog-focus-management.md) | Dialog focus management and keyboard accessibility | **4** | Client | Small |

---

## By theme

**Structural — where does logic live?**
[01](./01.centralize-authorization-in-middleware.md) (authorization),
[02](./02.thread-transaction-client-through-helpers.md) (transactions),
[04](./04.service-layer-and-repositories.md) (SQL),
[08](./08.single-validation-middleware.md) (validation),
[10](./10.client-capability-guard-component.md) (client gating).
All five say the same thing about different concerns: *declare it on the route or
in a named layer, not inline in a handler.* Doing them together produces a
coherent architecture; doing one alone produces an inconsistency.

**Operational — can this run anywhere but a laptop?**
[05](./05.postgres-and-redis-production-config.md),
[06](./06.structured-logging-and-request-ids.md),
[07](./07.health-readiness-and-graceful-shutdown.md),
[13](./13.environment-config-and-secret-management.md),
[14](./14.docker-compose-and-reproducible-dev-env.md),
[17](./17.repository-hygiene-and-generated-artifacts.md).
This cluster is the largest single gap between "a good learning project" and "a
deployable service", and it is mostly cheap.

**Contract and correctness** —
[15](./15.authorization-test-matrix.md),
[16](./16.openapi-as-contract-source-of-truth.md),
[18](./18.error-taxonomy-and-client-mapping.md),
[09](./09.pagination-strategy.md).

**Product-level RBAC** —
[03](./03.database-driven-role-hierarchy.md),
[19](./19.session-cap-and-device-management.md).
These change what the system *is*, not just how it is built.

**Client polish** —
[11](./11.react-query-cache-hardening.md),
[12](./12.axios-refresh-interceptor-correctness.md),
[20](./20.accessibility-and-dialog-focus-management.md).

---

## Where suggestions replace vulnerability fixes

Read these before writing any code — implementing both sides means writing work
you immediately delete.

| Suggestion | Supersedes | Note |
|---|---|---|
| [02 `withTransaction`](./02.thread-transaction-client-through-helpers.md) | Vulnerabilities [08](../vulnerabilities/08.pool-starvation-from-permission-checks-inside-transactions.md), [21](../vulnerabilities/21.non-transactional-audit-writes.md) | Both are *solved by* the wrapper. Do the suggestion, skip the individual fixes. |
| [03 DB-driven hierarchy](./03.database-driven-role-hierarchy.md) | Vulnerability [06](../vulnerabilities/06.role-rename-privilege-escalation.md) **Option B** | **Genuine either/or.** Option A (this suggestion) or Option B (make names immutable). Never both. |
| [05 pool config](./05.postgres-and-redis-production-config.md) | The pool settings quoted in Vulnerability [08](../vulnerabilities/08.pool-starvation-from-permission-checks-inside-transactions.md) | One pool config, one file. |
| [07 health endpoints](./07.health-readiness-and-graceful-shutdown.md) | Vulnerability [13](../vulnerabilities/13.unauthenticated-openapi-and-docs-exposure.md) step 3, Vulnerability [22](../vulnerabilities/22.trust-proxy-misconfiguration-enables-limit-bypass.md) step 4 | Both want a diagnostics endpoint. Build it once here. |
| [13 env config](./13.environment-config-and-secret-management.md) | Vulnerability [09](../vulnerabilities/09.jwt-secret-and-credentials-default-to-placeholders.md) | **Six findings add environment variables to `envHelper.ts`.** Edit it once. |
| [16 contract pipeline](./16.openapi-as-contract-source-of-truth.md) + [08](./08.single-validation-middleware.md) | Vulnerability [18](../vulnerabilities/18.weak-password-policy.md) step 3 | Generate the client constants rather than hand-syncing them. |
| [18 error codes](./18.error-taxonomy-and-client-mapping.md) | Vulnerability [23](../vulnerabilities/23.error-messages-leak-internal-detail.md) step 2 | That finding explicitly defers the decision here. |

---

## Client vs server

| Side | Count |
|------|-------|
| Server only | 8 — [01](./01.centralize-authorization-in-middleware.md), [02](./02.thread-transaction-client-through-helpers.md), [04](./04.service-layer-and-repositories.md), [05](./05.postgres-and-redis-production-config.md), [06](./06.structured-logging-and-request-ids.md), [07](./07.health-readiness-and-graceful-shutdown.md), [08](./08.single-validation-middleware.md) |
| Client only | 4 — [10](./10.client-capability-guard-component.md), [11](./11.react-query-cache-hardening.md), [12](./12.axios-refresh-interceptor-correctness.md), [20](./20.accessibility-and-dialog-focus-management.md) |
| Both | 8 — [03](./03.database-driven-role-hierarchy.md), [09](./09.pagination-strategy.md), [13](./13.environment-config-and-secret-management.md), [14](./14.docker-compose-and-reproducible-dev-env.md), [15](./15.authorization-test-matrix.md), [16](./16.openapi-as-contract-source-of-truth.md), [17](./17.repository-hygiene-and-generated-artifacts.md), [18](./18.error-taxonomy-and-client-mapping.md), [19](./19.session-cap-and-device-management.md) |

---

## If you only do four

[02](./02.thread-transaction-client-through-helpers.md) (fixes two
vulnerabilities for free), [13](./13.environment-config-and-secret-management.md)
(absorbs six findings' config changes),
[15](./15.authorization-test-matrix.md) (proves the security fixes worked and
stops regressions), [01](./01.centralize-authorization-in-middleware.md) (the
structural change with the largest compounding return).

Sequencing and the before/after project score are in the
[master index](../index.md).
