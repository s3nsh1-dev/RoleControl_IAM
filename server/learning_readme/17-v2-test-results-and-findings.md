# V2 Test Results And Findings

This note is the learning-oriented companion to the official result docs:

- [docs/testing-history/v2.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/testing-history/v2.md)
- [tests/README.md](/home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/README.md)

The official history is maintained outside `learning_readme`.
This file is for deeper explanation, assessment, and suggestions.

## 1. Final V2 Outcome

Final verified run:

- date: `2026-04-12`
- command: `pnpm test`
- result: `21 passed, 0 failed`

`v2` is now the active suite.

## 2. What Changed In V2

Compared to the original archived suite, `v2` added:

- real versioned test structure
- full active-vs-archive split between `v1` and `v2`
- auth failure-path coverage
- refresh misuse coverage
- user self-protection coverage
- role / permission lifecycle coverage
- create-on-behalf coverage
- richer audit-log verification
- stronger cookie client behavior for logout and replay tests

## 3. Most Important Finding

The most important finding from `v2` was not just a missing test.
It was a real auth flaw.

### Refresh replay vulnerability

What the test exposed:

- old refresh tokens were still accepted after rotation

Why it happened:

- refresh tokens were being hashed with bcrypt directly
- bcrypt only considers the first 72 bytes of input
- JWT refresh tokens are long enough that two different tokens can share that effective prefix
- because of that, old and new refresh tokens could both validate against the same stored hash

Why this matters:

- it defeats the point of refresh token rotation
- a stolen old refresh token can continue to work after a refresh

What was changed:

- refresh-token hashing now hashes the token with SHA-256 first
- the SHA-256 digest is then stored and compared through bcrypt

Assessment:

- this was the right fix for the current architecture
- it preserves the existing DB-backed session model
- it avoids changing the password-hashing flow

## 4. What I Think V2 Now Proves

`v2` now gives much better evidence that the project behaves correctly in the areas that matter most.

### Auth credibility improved

`v2` now proves:

- invalid credentials fail correctly
- refresh misuse is rejected
- revoked and expired sessions are rejected
- logout is safe and idempotent
- session-cap logic still works

### RBAC credibility improved

`v2` now proves:

- protected routes do reject unauthenticated access
- self-delete is blocked
- admin-vs-super-admin delete hierarchy is enforced
- self-role mutation protections are enforced
- admin cannot delete a super-admin's post

### Audit credibility improved

The suite now checks not only whether an audit row exists, but whether:

- `old_values` are correct
- `new_values` are correct
- metadata fields carry the intended meaning

That is much stronger than count-only assertions.

## 5. What I Still Consider Weak Or Deferred

### A. Last super-admin deletion branch

The controller contains this branch, but under current route behavior it is not meaningfully reachable as an external API scenario because:

- self-delete is blocked first
- deleting another super-admin when two exist still leaves one super-admin

My view:

- the logic can stay
- but it should not be treated as a must-have route test unless the flow is made externally reachable

### B. Some hierarchy branches remain permission-gated before role-gated

Example:

- admin user creation hierarchy is not really a route-level scenario right now because admin does not have `create:user`

My view:

- that is fine
- tests should target reachable behavior, not imagined behavior

### C. Error middleware is still not exhaustively route-covered

`v2` covers real `409` and `400` outcomes through natural route behavior, which is good.
But not every raw database error translation branch is directly covered.

My view:

- that is acceptable for `v2`
- route-level behavior matters more than forced internal error-code coverage

## 6. Suggestions Before V3 And V4

### Before V3

Make migration tests narrow and purpose-built.

Do not rerun all of `v2` just to say migrations were tested.
Instead:

- keep `v2` as the broad regression suite
- let `v3` prove migration correctness and migration-affected behavior only

### Before V4

Add rate-limiter tests only for routes where rate limiting is actually attached.

That means `v4` should verify:

- below-limit success
- above-limit `429`
- descriptive limiter messages
- `Retry-After` if returned
- business logic still behaves normally before the limiter trips

### General testing direction

If the suite grows further, keep preferring:

- scenario tests
- real route behavior
- descriptive error assertions
- audit-payload verification

over:

- branch-chasing for its own sake
- exact-string brittleness
- artificially forced database errors

## 7. Final Assessment

I think `v2` is a meaningful upgrade, not just a bigger test count.

The biggest improvements are:

- better security coverage
- better denial-path coverage
- better audit verification
- official versioned test history

Most importantly, `v2` already paid off by finding a real refresh-token replay problem.
That alone justified the rewrite.
