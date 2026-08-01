# Session Management

This project stores refresh-token sessions in `user_sessions`. Admin session
revocation is a soft revoke: the row stays available for audit and inspection,
but it can no longer validate refresh-token rotation.

## Admin Revocation

`PATCH /api/sessions/:sessionId/revoke` revokes one active session. It requires
the `revoke:session` permission, updates `revoked_at` and `expires_at` to
`NOW()`, replaces `refresh_token_hash` with `REVOKED`, and writes a `revoke`
audit log for the session id.

`PUT /api/users/:userId/sessions/revoke-all` revokes every active session for a
target user. It requires the stronger `delete:session` permission, applies the
same soft-revoke update to all active rows, and writes a `delete` audit log
against the user id with `revokedCount` and `revokedSessionIds` metadata.

## Logout vs Admin Revocation

`POST /api/auth/logout` is the user self-service path. It clears auth cookies
and revokes the current refresh session when the refresh cookie can be
validated.

Admin revocation is an operational path for managing another user's sessions.
It uses RBAC permissions and audit logging so session administration remains
traceable.

## Session Row Cap

`enforceSessionRowCapPerUser` keeps each user under
`MAX_SESSION_ROWS_PER_USER = 2` during login/refresh flows by deleting the
oldest excess rows before a new session is inserted. This cleanup is separate
from admin revocation: revocation preserves rows for visibility, while the row
cap prevents unbounded session-table growth.

## RBAC Split

`revoke:session` allows single-session revocation and is assigned to `admin`
and `super-admin`.

`delete:session` allows bulk revocation of all active sessions for one user and
is assigned only to `super-admin`.
