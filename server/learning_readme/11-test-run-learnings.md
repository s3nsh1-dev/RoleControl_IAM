# Test Run Learnings

This note captures what we learned from wiring and running the first real integration test suite for this project.

## What We Actually Tested

The suite does not mock controllers or the database.

It tests:

- the real Express app
- the mounted `/api/...` routes
- real cookie handling for login, refresh, and logout
- real PostgreSQL reads and writes
- real schema reset before each test

That gave us confidence in behavior that unit tests alone would not catch:

- route alias wiring
- cookie persistence and rotation
- session row lifecycle
- audit log writes
- cross-controller RBAC flow correctness

## What The First Runs Taught Us

### 1. The test suite is only as real as the database connection

The first failing runs were not logic failures.

They failed because PostgreSQL was not reachable and the suite hit:

- `ECONNREFUSED 127.0.0.1:5432`

That confirmed the suite is truly integration-level and depends on the real DB being available.

## 2. Schema reset needs to be importable, not CLI-only

The existing schema setup lived as a script entrypoint.

To make tests deterministic, the schema reset logic had to be exported so tests could call it directly before each case.

That change made the test setup much cleaner:

- reset schema
- reseed RBAC references
- run a single test

## 3. DB-backed auth tests are much better than mocked token tests

Running the login / refresh / logout path against real `user_sessions` rows made several things provable:

- login creates a session row
- refresh rotates the stored hash without creating a new session row
- logout revokes the session row
- refresh after logout fails

This was stronger than just checking response payloads.

## 4. Route aliases needed real end-to-end verification

The project now uses public route aliases:

- `uId`
- `tId`
- `pId`
- `rName`

The tests proved those aliases are not just documented but actually wired through the mounted routes and controllers.

Without this, it would have been easy to keep stale param names in controllers.

## 5. Single-client `Promise.all(...)` is a real maintenance risk

One of the test runs surfaced a `pg` deprecation warning:

- calling `client.query()` concurrently on the same transaction client is deprecated

That did not fail the suite immediately, but it revealed code that would be fragile against `pg@9`.

We fixed that by replacing those `Promise.all(...)` blocks with sequential awaits in transaction-scoped controllers.

So the tests did not just validate behavior.
They also exposed future-compatibility issues.

## 6. Expected application errors should not be logged like system failures

The bootstrap registration test intentionally verifies that the second super-admin registration is blocked.

That expected `403` path was being printed as a transaction error, which was noisy and misleading.

We changed the logging so:

- normal `AppError` rejections are not logged as transaction failures
- unexpected internal failures still get logged

This made the test output cleaner and the controller behavior more honest.

## 7. Audit logging is worth testing through the database, not by assumption

The post tests verified audit behavior by querying `audit_logs` directly after:

- create
- update
- delete

That matters because “audit logging exists in code” is not the same as “audit rows really land in the database under the expected mutation flow.”

## Final Result Of The Last Verified Run

Command:

```bash
pnpm test
```

Result:

- 5 tests passed
- 0 tests failed

Covered behaviors:

- bootstrap super-admin registration lock
- login / refresh / logout session lifecycle
- session cap of 2 rows
- route alias contract
- post audit logging

## Practical Conclusion

The first integration suite already paid off in three ways:

- it verified the main auth and RBAC flows end to end
- it forced the schema/bootstrap code into a reusable shape
- it exposed non-obvious quality issues that were not visible from manual reading alone

That is the main thing we learned:

for a project like this, tests are not just “proof after implementation.”
They actively sharpen the implementation. 
