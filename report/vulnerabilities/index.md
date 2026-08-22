# Vulnerabilities index

23 findings. Ranked out of 10 by **exploitability × blast radius × likelihood**,
not by CVSS. A "10" would be unauthenticated remote code execution; a "3" is
something that will bite you later rather than now.

**Side** means where the fix lives, not where the symptom appears.

---

## By severity

| # | Finding | Rank | Side | Category |
|---|---------|------|------|----------|
| [01](./01.jwt-token-confusion-and-session-revocation-bypass.md) | Refresh token works as an access token; revoking a session logs nobody out | **9** | Server | Broken authentication |
| [02](./02.overpermissive-default-user-role.md) | Default `user` role reads every user, session and audit log | **8** | Server | Excessive privilege |
| [03](./03.deactivated-users-can-still-log-in.md) | `is_active` is stored, displayed, and never enforced | **8** | Server | Dead security control |
| [04](./04.password-change-does-not-revoke-sessions.md) | Password change leaves stolen sessions alive | **7** | Server | Credential rotation |
| [05](./05.refresh-token-rotation-without-reuse-detection.md) | Tokens rotate, but replay is never detected | **7** | Server | Token theft persistence |
| [06](./06.role-rename-privilege-escalation.md) | Privilege hierarchy keyed on mutable role *names* | **7** | Server | Privilege escalation |
| [07](./07.rate-limiters-fail-open.md) | Killing Redis disables all brute-force protection | **7** | Server | Anti-automation |
| [08](./08.pool-starvation-from-permission-checks-inside-transactions.md) | Permission checks grab a second connection inside a transaction | **7** | Server | Denial of service |
| [09](./09.jwt-secret-and-credentials-default-to-placeholders.md) | `JWT_SECRET` silently defaults to `"placeholder"` | **7** | Server | Cryptographic failure |
| [10](./10.no-security-headers-no-cors-policy-and-cookie-flags.md) | No helmet, no CORS policy, incomplete cookie flags | **6** | Both | Misconfiguration |
| [11](./11.session-revocation-and-peer-actions-lack-hierarchy-checks.md) | An admin can revoke a super-admin's sessions | **6** | Server | Missing function-level authz |
| [12](./12.rbac-self-destruct-via-role-and-permission-deletion.md) | One request can permanently brick the RBAC system | **6** | Server | Missing integrity invariants |
| [14](./14.auth-router-is-not-actually-protected.md) | `authProtectedRouter` has no auth on 2 of 3 routes | **6** | Server | Misleading abstraction |
| [17](./17.no-authentication-audit-trail.md) | Every data mutation is audited; zero auth events are | **6** | Server | Logging failure |
| [13](./13.unauthenticated-openapi-and-docs-exposure.md) | `/api/docs` is public and above every rate limiter | **5** | Server | Information disclosure |
| [15](./15.login-user-enumeration-via-timing.md) | Login timing reveals whether an email exists | **5** | Server | User enumeration |
| [18](./18.weak-password-policy.md) | 4-character passwords; client and server disagree | **5** | Both | Authentication failure |
| [20](./20.updatepost-and-post-ownership-inconsistencies.md) | `updatePost` ignores ownership rank; `deletePost` enforces it | **5** | Server | Inconsistent object authz |
| [21](./21.non-transactional-audit-writes.md) | Two controllers mutate and audit on separate connections | **5** | Server | Audit integrity |
| [22](./22.trust-proxy-misconfiguration-enables-limit-bypass.md) | `TRUST_PROXY` unvalidated; wrong value breaks every IP limiter | **5** | Server | IP spoofing |
| [16](./16.client-auth-flag-is-persisted-and-forgeable.md) | `isAuthenticated` persisted in `localStorage` | **4** | Client | Trust boundary |
| [19](./19.nested-session-routes-run-auth-and-rate-limit-twice.md) | Nested session routes double-consume rate-limit tokens | **4** | Server | Middleware ordering |
| [23](./23.error-messages-leak-internal-detail.md) | Auth failures concatenate internal error text into 401s | **3** | Server | Error disclosure |

---

## By theme

**Session and token lifecycle** — the largest cluster, and the one that matters
most for an IAM product: [01](./01.jwt-token-confusion-and-session-revocation-bypass.md),
[03](./03.deactivated-users-can-still-log-in.md),
[04](./04.password-change-does-not-revoke-sessions.md),
[05](./05.refresh-token-rotation-without-reuse-detection.md),
[19](./19.nested-session-routes-run-auth-and-rate-limit-twice.md).
Together they mean **no action available to any operator terminates an active
session**. Fix 01 first; the other four are ineffective without it.

**Authorization scope** — [02](./02.overpermissive-default-user-role.md),
[06](./06.role-rename-privilege-escalation.md),
[11](./11.session-revocation-and-peer-actions-lack-hierarchy-checks.md),
[12](./12.rbac-self-destruct-via-role-and-permission-deletion.md),
[20](./20.updatepost-and-post-ownership-inconsistencies.md).
The RBAC engine is correct; the seeded permission sets are too broad and the
hierarchy layer is applied inconsistently.

**Rate limiting** — [07](./07.rate-limiters-fail-open.md),
[19](./19.nested-session-routes-run-auth-and-rate-limit-twice.md),
[22](./22.trust-proxy-misconfiguration-enables-limit-bypass.md).
Two ways to defeat the limiters (remove the check, forge the key) and one way the
accounting is wrong. All three need fixing; none substitutes for another.

**Deployment configuration** — [09](./09.jwt-secret-and-credentials-default-to-placeholders.md),
[10](./10.no-security-headers-no-cors-policy-and-cookie-flags.md),
[13](./13.unauthenticated-openapi-and-docs-exposure.md),
[22](./22.trust-proxy-misconfiguration-enables-limit-bypass.md).
Everything here is "works on localhost, undefined behaviour anywhere else".

**Observability** — [17](./17.no-authentication-audit-trail.md),
[21](./21.non-transactional-audit-writes.md),
[23](./23.error-messages-leak-internal-detail.md).
You can reconstruct every data change and no authentication event.

---

## Client vs server

| Side | Count | Findings |
|------|-------|----------|
| Server only | 20 | 01–09, 11–15, 17, 19–23 |
| Client only | 1 | [16](./16.client-auth-flag-is-persisted-and-forgeable.md) |
| Both | 2 | [10](./10.no-security-headers-no-cors-policy-and-cookie-flags.md), [18](./18.weak-password-policy.md) |

That distribution is itself a finding, and a favourable one. **The client makes no
authorization decisions of its own** — it renders capabilities the server
computes, gates routes on a server response, and stores no credentials. The one
client-side issue is a vestigial flag with no readers. Every real vulnerability is
server-side, which is exactly where you want them: fixable in one place, with no
deployed client to update.

---

## Reading order

If you read only three: [01](./01.jwt-token-confusion-and-session-revocation-bypass.md),
[02](./02.overpermissive-default-user-role.md),
[03](./03.deactivated-users-can-still-log-in.md).

Ordering constraints, contradictions, and the phased fix plan are in the
[master index](../index.md).

---

Previous: [Report index](../index.md).
Next: [V01 Refresh token works as an access token](./01.jwt-token-confusion-and-session-revocation-bypass.md), the finding four others depend on.
