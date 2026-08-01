# Global API Rate Limiter Plan

## Summary

Add a Redis-backed global IP rate limiter as the outermost middleware for the API surface, but do not apply it to selected auth endpoints that already have stricter dedicated protection.

Chosen defaults:

- Global limiter scope: all /api/\* routes
- Exempt routes: /api/auth/login, /api/auth/refresh
- Initial threshold: 60 requests / 60 seconds per IP
- Failure policy: fail open if Redis is unavailable or degraded, matching the current auth limiter approach

Why this shape:

- It protects the general API from loops, scans, and noisy clients.
- It avoids double-counting the two most sensitive auth endpoints, where tighter dedicated limiters already exist.
- It reuses the project’s existing Redis sliding-window limiter utilities instead of introducing a second rate-limit implementation style.

## Implementation Changes

### Middleware and reusable logic

Add a new middleware:

- src/middleware/globalRateLimiting.middleware.ts

Behavior:

- Resolve trusted client IP using the existing getTrustedClientIp()
- Build Redis key as rate:global:ip:{clientIp}
- Call the existing allowSlidingWindow() helper
- If Redis is not ready or the Redis check degrades, log and bypass
- Redis readiness checks
- sliding-window decision path
- Retry-After behavior

No new hashing or special key encoding is needed for the global limiter because the key dimension is IP only.

### Environment configuration

Extend src/utils/envHelper.ts with:

- RATE_LIMIT_GLOBAL_IP_LIMIT
- RATE_LIMIT_GLOBAL_IP_WINDOW_MS

Chosen defaults:

Update src/app.ts to mount the global limiter before API routes, but not as a blanket app.use(globalRateLimiting) across the whole app.

Use this structure:

- keep trust proxy
- keep parsers and cookie middleware as needed
- mount exempt auth routes first
- mount the global limiter for /api
- mount the remaining /api routers after that

Concrete routing intent:

- /api/auth/login keeps only loginRateLimiting
- /api/auth/refresh keeps only refreshRateLimiting
- /api/auth/logout and /api/auth/register should pass through the global limiter unless a later decision adds a registration-specific limiter
- all other /api/users, /api/roles, /api/permissions, /api/user-roles, /api/role-permissions, and /api/posts routes pass through the global limiter

The cleanest implementation shape is to split auth mounting in app.ts so the exempt routes are mounted explicitly and the rest of the auth router is mounted behind the global limiter, or
to refactor auth routing into exempt and non-exempt route groups. The plan should prefer the least awkward structure that keeps exemption logic obvious at the router boundary.

## End-to-End Logic

### Non-exempt API route flow

For a route like GET /api/users:

1. Request enters Express.
2. Global limiter runs for /api.
3. Client IP is normalized and checked against rate:global:ip:{clientIp}.
4. If under limit, request proceeds to auth middleware / controller logic as usual.
5. If over limit, response returns 429 with Retry-After.
6. No route-specific limiter is involved unless a future route adds one.

### Exempt auth route flow

For POST /api/auth/login and GET /api/auth/refresh:

1. Request bypasses the global limiter.
2. Existing route-specific limiter runs.
3. Existing controller-specific second-layer limiter logic still applies:
   - login failed-attempt limiter by email + IP

- they already have stricter purpose-built limits
- global counting there adds little value
- it makes testing and reasoning noisier
- a general limiter should not mask auth-specific limiter behavior

## Test Plan

Add a dedicated v4 rate-limit suite and keep it focused.

Main scenarios:

- a non-exempt route such as GET /api/users returns 429 after the global limit is exceeded from one IP
- a blocked global request includes a numeric Retry-After header
- allow injecting a stable fake client IP through headers plus trust proxy behavior, or extend the HTTP test client to send X-Forwarded-For where useful
- avoid changing the existing v2/v3 suites unless a shared helper improvement is needed
- write a complete end to end test for rate limiting checks or each api endpoints

## Assumptions

- We are limiting only the API surface, not /. (what does this means ?)

NO Docs updates. docs will be updated once the project is done from every end for how ignore docs just create a new readme in learning_readme for explainating what you did , why and conclusion..

the end
