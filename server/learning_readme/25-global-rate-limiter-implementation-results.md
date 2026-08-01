# Global API Rate Limiter Implementation Results

This note is the implementation follow-up to:

- `24-global-ratelimiting-plan.md`

It explains what was implemented, why the routing shape was chosen, and what the final request flow now looks like.

---

## 1. What Was Implemented

The project now has a Redis-backed global IP rate limiter for the API surface.

Implemented behavior:

- all non-exempt `/api/*` routes now pass through a global limiter
- `POST /api/auth/login` is exempt from the global limiter
- `GET /api/auth/refresh` is exempt from the global limiter
- the global limiter uses the same Redis sliding-window utility already used by the auth limiters
- the limiter fails open if Redis is unavailable or the Redis check degrades
- a focused `v4` test suite was added for global-rate-limit verification

---

## 2. Why Login And Refresh Were Exempted

Those two routes already had stricter route-specific protection:

- login already had:
  - IP limiter
  - failed-login limiter by `email + IP`
- refresh already had:
  - IP limiter
  - session limiter

So the project kept the global limiter focused on the rest of the API surface instead of layering another bucket on top of those two auth routes.

That means the design is:

- general API abuse control through the global limiter
- dedicated auth abuse control through the existing login and refresh limiters

---

## 3. Routing Shape Chosen

The app now mounts auth routes in two groups:

- exempt auth routes mounted before the global limiter
- non-exempt auth routes mounted after the global limiter

This was chosen instead of adding path-condition exceptions inside the global middleware itself.

Why that was better:

- the exemption boundary is visible in routing
- the middleware stays simple
- there is less hidden branching inside the limiter

---

## 4. End-To-End Flow

### Non-exempt route example

For a route like `GET /api/users`:

1. request enters the app
2. global limiter runs
3. Redis key `rate:global:ip:{clientIp}` is checked
4. if under limit, request proceeds normally
5. if over limit, response returns `429` with `Retry-After`

### Exempt route example

For `POST /api/auth/login`:

1. request bypasses the global limiter at the router boundary
2. existing login IP limiter still runs
3. existing failed-login limiter inside the controller still runs

For `GET /api/auth/refresh`:

1. request bypasses the global limiter
2. existing refresh IP limiter still runs
3. existing refresh session limiter inside the controller still runs

---

## 5. Files Touched

Core implementation:

- `src/middleware/globalRateLimiting.middleware.ts`
- `src/app.ts`
- `src/routes/auth.route.ts`
- `src/utils/envHelper.ts`
- `.env.example`

Verification:

- `tests/v4-rate-limits/*`

---

## 6. Conclusion

The project now has a proper outer rate-limit layer for the API without muddying the behavior of the already-hardened auth routes.

This is a good final shape for this stage of the project because:

- the whole API now has a baseline abuse guardrail
- login and refresh keep their specialized security-focused rate limits
- the project still uses one reusable Redis rate-limit implementation instead of multiple inconsistent patterns
