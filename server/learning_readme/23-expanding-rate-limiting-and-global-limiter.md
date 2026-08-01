# Expanding Rate Limiting — Global Limiter and Beyond

This note builds on:

- `21-auth-rate-limiter-production-review.md`
- `22-auth-rate-limiter-implementation-results.md`

Those notes covered the login and refresh rate limiters. This note answers:

- what else in this project can and should be rate limited
- why a global limiter is the right final layer
- what the implementation steps are for each new limiter
- what order to implement them in

---

## 1. What Is Already Rate Limited

Before planning new limiters, here is what the project already protects:

| Route | Layer | Key Dimension | Location |
|---|---|---|---|
| `POST /api/auth/login` | IP limiter | `rate:login:ip:{clientIp}` | `loginRateLimiting.middleware.ts` |
| `POST /api/auth/login` | Failed-attempt limiter | `rate:login:fail:email-ip:{hash}` | `login.ts` controller |
| `GET /api/auth/refresh` | IP limiter | `rate:refresh:ip:{clientIp}` | `refreshRateLimiting.middleware.ts` |
| `GET /api/auth/refresh` | Session limiter | `rate:refresh:session:{sessionId}` | `refreshToken.ts` controller |

Everything else — registration, logout, all CRUD routes for users, posts, roles, permissions, user-roles, and role-permissions — has **zero rate limiting**.

---

## 2. What Else Should Be Rate Limited

Here are all the meaningful rate-limiting layers this project can benefit from, ordered from **highest impact to lowest**.

### A. Global IP Rate Limiter (Your Idea — Do This)

**What it is:**

A single middleware that runs on every incoming request before any route handler. It limits the total number of requests any single IP address can make across the entire API within a rolling window.

**Why it matters:**

- It is the **outermost safety net**. Even if someone finds a route that has no specific limiter, the global limiter catches it.
- It protects against basic volumetric abuse: scanning, scraping, fuzzing, accidental client loops.
- It catches abuse patterns that no route-specific limiter can catch alone — like an attacker rotating across many different endpoints.

**Why it belongs at the `app.use()` level:**

The global limiter must run before any route matching. It is not tied to any specific business logic. It answers one question: "Is this IP sending too many requests in total?"

**Recommended defaults:**

| Setting | Value | Rationale |
|---|---|---|
| Limit | 100 requests | Generous enough for normal browsing, tight enough to stop automated abuse |
| Window | 60 seconds (60,000 ms) | Short enough to recover quickly from false positives |

These are intentionally loose. The global limiter is a blunt safety net. The route-specific limiters (login, refresh) do the precision work.

**Redis key format:**

```
rate:global:ip:{clientIp}
```

**Where it goes:**

```
src/middleware/globalRateLimiting.middleware.ts
```

Mounted in `app.ts` as:

```typescript
app.use(globalRateLimiting);  // before all route handlers
app.use(express.json());
// ... rest of middleware and routes
```

> Important: Mount it **before** `express.json()`. If someone is flooding you with massive JSON payloads, you want to reject them before Express spends CPU parsing the body.

**Implementation steps:**

1. Add `RATE_LIMIT_GLOBAL_IP_LIMIT` and `RATE_LIMIT_GLOBAL_IP_WINDOW_MS` to `envHelper.ts` with the defaults above
2. Create `src/middleware/globalRateLimiting.middleware.ts` — it will look almost identical to `loginRateLimiting.middleware.ts`, just with the global key and global env vars
3. Mount it in `app.ts` as the very first `app.use()` after `trust proxy`
4. Add a test that sends requests above the limit and verifies a `429` with `Retry-After`

**Code sketch for `globalRateLimiting.middleware.ts`:**

```typescript
import { asyncMiddleware } from "@/utils/asyncMiddleware.ts";
import env from "@/utils/envHelper.ts";
import {
  allowSlidingWindow,
  getTrustedClientIp,
  isRedisRateLimitReady,
  throwRateLimitError,
} from "@/utils/rateLimit.util.ts";

const globalRateLimiting = asyncMiddleware(async (req, res) => {
  const clientIp = getTrustedClientIp(req);
  const ipKey = `rate:global:ip:${clientIp}`;

  if (!isRedisRateLimitReady()) {
    console.warn("Redis is not ready. Bypassing global IP rate limiter.");
    return;
  }

  const ipCheck = await allowSlidingWindow(
    ipKey,
    env.RATE_LIMIT_GLOBAL_IP_LIMIT,
    env.RATE_LIMIT_GLOBAL_IP_WINDOW_MS,
  );

  if (!ipCheck) {
    console.warn("Global IP rate limiter degraded. Bypassing request.");
    return;
  }

  if (!ipCheck.allowed) {
    throwRateLimitError(
      res,
      ipCheck.retryAfterMs,
      "Too many requests. Please try again later.",
    );
  }
});

export { globalRateLimiting };
```

---

### B. Registration Rate Limiter

**What it is:**

An IP-based limiter specifically for `POST /api/auth/register`.

**Why it matters:**

Registration is currently **completely unprotected**. Someone can:

- spam account creation from one IP
- exhaust your `users` table and ID sequence
- trigger expensive bcrypt hashing (your `SALT_ROUNDS` is 10, that is already noticeable per request)
- attempt to find out which emails are already registered (the current code returns `"User already exists with this email"`)

**Why the global limiter is not enough:**

The global limiter might allow 100 requests/minute. But you almost certainly don't want 100 registrations per minute from the same IP. Registration should have a **much tighter** limit.

**Recommended defaults:**

| Setting | Value | Rationale |
|---|---|---|
| Limit | 3 requests | Almost nobody legitimately registers 3 accounts in a short window |
| Window | 60 minutes (3,600,000 ms) | Long window because registration is rare and abuse is expensive |

**Redis key format:**

```
rate:register:ip:{clientIp}
```

**Where it goes:**

A new middleware `src/middleware/registrationRateLimiting.middleware.ts`, mounted in `auth.route.ts` on the register route:

```typescript
authRouter.route("/register").post(registrationRateLimiting, authRegistration);
```

**Implementation steps:**

1. Add `RATE_LIMIT_REGISTER_IP_LIMIT` and `RATE_LIMIT_REGISTER_IP_WINDOW_MS` to `envHelper.ts`
2. Create `src/middleware/registrationRateLimiting.middleware.ts` (same pattern as login/refresh IP limiters)
3. Mount it on the `/register` route in `auth.route.ts`
4. Add a test that verifies repeated registrations from the same IP get `429`

**Bonus hardening (optional):**

Change the registration error from `"User already exists with this email"` to a generic message like `"Registration failed"`. This mirrors the login hardening you already did — it prevents email enumeration through the registration endpoint.

---

### C. Authenticated User Rate Limiter

**What it is:**

A per-user limiter that runs after `checkCookieSignature` on all authenticated CRUD routes.

**Why it matters:**

Right now, once someone is logged in, they can hit the CRUD routes as fast as they want. The only protection would be the global IP limiter. But:

- a single authenticated user could have legitimate access from multiple IPs (mobile + desktop)
- the global limiter wouldn't connect those as the same user
- some users might abuse the API from within normal-looking IP patterns

**How it works:**

After `checkCookieSignature` runs, `req.user` is populated with the access token payload, which contains the user ID (`uId`). You can build a per-user rate-limit key from that.

**Recommended defaults:**

| Setting | Value | Rationale |
|---|---|---|
| Limit | 60 requests | Reasonable for API browsing |
| Window | 60 seconds (60,000 ms) | Standard per-minute rate |

**Redis key format:**

```
rate:user:{userId}
```

**Where it goes:**

A new middleware `src/middleware/authenticatedRateLimiting.middleware.ts`, mounted immediately after `checkCookieSignature` in each authenticated route file:

```typescript
userRouter.use(checkCookieSignature);
userRouter.use(authenticatedRateLimiting);
```

Or alternatively, create a composed middleware that chains both:

```typescript
// In a helper
const requireAuth = [checkCookieSignature, authenticatedRateLimiting];

// In routes
userRouter.use(...requireAuth);
```

**Implementation steps:**

1. Add `RATE_LIMIT_USER_LIMIT` and `RATE_LIMIT_USER_WINDOW_MS` to `envHelper.ts`
2. Create `src/middleware/authenticatedRateLimiting.middleware.ts` — this one reads `req.user.uId` to build the key
3. Mount it after `checkCookieSignature` on all authenticated route files
4. Add a test that verifies a logged-in user hitting any CRUD route above the limit gets `429`

**Code sketch:**

```typescript
import { asyncMiddleware } from "@/utils/asyncMiddleware.ts";
import env from "@/utils/envHelper.ts";
import {
  allowSlidingWindow,
  isRedisRateLimitReady,
  throwRateLimitError,
} from "@/utils/rateLimit.util.ts";

const authenticatedRateLimiting = asyncMiddleware(async (req, res) => {
  const userId = req.user?.uId;
  if (!userId) {
    // If no user identity, skip — checkCookieSignature should have rejected already
    return;
  }

  const userKey = `rate:user:${userId}`;

  if (!isRedisRateLimitReady()) {
    console.warn("Redis is not ready. Bypassing user rate limiter.");
    return;
  }

  const userCheck = await allowSlidingWindow(
    userKey,
    env.RATE_LIMIT_USER_LIMIT,
    env.RATE_LIMIT_USER_WINDOW_MS,
  );

  if (!userCheck) {
    console.warn("User rate limiter degraded. Bypassing request.");
    return;
  }

  if (!userCheck.allowed) {
    throwRateLimitError(
      res,
      userCheck.retryAfterMs,
      "Too many requests. Please slow down.",
    );
  }
});

export { authenticatedRateLimiting };
```

---

### D. Admin/Write-Operation Rate Limiter (Optional, Lower Priority)

**What it is:**

Tighter rate limits specifically on write operations (POST, PUT, DELETE) on sensitive admin routes — roles, permissions, user-roles, role-permissions.

**Why it matters:**

These routes modify the RBAC structure itself. An admin account doing 50 role assignments per minute is almost certainly not normal human behavior. It is either:

- a compromised admin token being used for automated privilege escalation
- a buggy client script

**How it differs from the user limiter:**

The authenticated user limiter is broad — it covers all requests. This would be an **additional, tighter** layer that only counts write operations on admin resources.

**Recommended approach:**

Rather than creating 4 separate middleware files, create one configurable middleware and mount it with different settings:

```typescript
// Factory function
const writeRateLimiter = (resource: string, limit: number, windowMs: number) =>
  asyncMiddleware(async (req, res) => {
    if (req.method === "GET") return; // Skip reads

    const userId = req.user?.uId;
    if (!userId) return;

    const key = `rate:write:${resource}:${userId}`;
    // ... same allowSlidingWindow pattern
  });

// Usage in routes
roleRouter.use(checkCookieSignature);
roleRouter.use(writeRateLimiter("roles", 10, 60_000));
```

**Implementation priority:** Low. This is a hardening layer. The global + user limiter covers 90% of the risk already. Do this only if you want to demonstrate defense-in-depth in the project.

---

## 3. What About Logout?

`GET /api/auth/logout` is currently unprotected.

**Should you rate limit it?**

Honestly, it is low risk. Logout is idempotent, does a simple UPDATE to revoke a session, and clears cookies. The computational cost is minimal.

However, an attacker could use it to:

- repeatedly revoke a user's session (annoying, but the attacker would need the user's refresh token cookie)
- generate noise in your session table

**Recommendation:** The global IP limiter is sufficient for logout. No dedicated limiter needed.

---

## 4. Summary of All Rate Limit Layers

Here is the full picture of what the project would have after implementing everything described above:

| Layer | Scope | Key | Where | Priority |
|---|---|---|---|---|
| **Global IP** | All requests | `rate:global:ip:{ip}` | `app.ts` middleware | **Do first** |
| **Login IP** | Login route | `rate:login:ip:{ip}` | `loginRateLimiting.middleware.ts` | ✅ Already done |
| **Login Failure** | Failed logins | `rate:login:fail:email-ip:{hash}` | `login.ts` controller | ✅ Already done |
| **Refresh IP** | Refresh route | `rate:refresh:ip:{ip}` | `refreshRateLimiting.middleware.ts` | ✅ Already done |
| **Refresh Session** | Per session | `rate:refresh:session:{sId}` | `refreshToken.ts` controller | ✅ Already done |
| **Registration IP** | Register route | `rate:register:ip:{ip}` | New middleware | Do second |
| **Authenticated User** | All authed routes | `rate:user:{uId}` | New middleware | Do third |
| **Admin Write** | Admin write ops | `rate:write:{resource}:{uId}` | Factory middleware | Optional |

---

## 5. Interaction Between Layers

A single login request from an unauthenticated user now passes through:

```
Global IP limiter  →  Login IP limiter  →  Controller (failure limiter if auth fails)
```

A single CRUD request from an authenticated user passes through:

```
Global IP limiter  →  checkCookieSignature  →  Authenticated User limiter  →  Controller
```

This is defense-in-depth:

- the global limiter catches volumetric abuse regardless of route
- the route-specific limiters apply tighter, context-aware limits
- the controller-level limiters apply the strictest rules with the most identity context

If any layer rejects, the request stops immediately with `429`.

---

## 6. Recommended Implementation Order

### Step 1: Global IP Limiter

This gives you the broadest protection with the least code. It reuses everything already built in `rateLimit.util.ts`.

**Files to touch:**

- `src/utils/envHelper.ts` — add 2 new env vars
- `src/middleware/globalRateLimiting.middleware.ts` — new file
- `src/app.ts` — mount the middleware

**Estimated effort:** 15 minutes. You already have the pattern.

---

### Step 2: Registration Rate Limiter

This closes the most obvious unprotected auth endpoint.

**Files to touch:**

- `src/utils/envHelper.ts` — add 2 new env vars
- `src/middleware/registrationRateLimiting.middleware.ts` — new file
- `src/routes/auth.route.ts` — mount on `/register`

**Estimated effort:** 10 minutes. Copy-paste of the login IP limiter with different key and env vars.

---

### Step 3: Authenticated User Rate Limiter

This protects the entire authenticated API surface.

**Files to touch:**

- `src/utils/envHelper.ts` — add 2 new env vars
- `src/middleware/authenticatedRateLimiting.middleware.ts` — new file
- `src/routes/user.route.ts` — mount after `checkCookieSignature`
- `src/routes/post.route.ts` — mount after `checkCookieSignature`
- `src/routes/role.route.ts` — mount after `checkCookieSignature`
- `src/routes/permission.route.ts` — mount after `checkCookieSignature`
- `src/routes/user_roles.route.ts` — mount after `checkCookieSignature`
- `src/routes/role_permissions.route.ts` — mount after `checkCookieSignature`

**Estimated effort:** 20 minutes. One new middleware, six route files to add one line each.

---

### Step 4 (Optional): Admin Write Limiter

Only if you want the extra hardening layer.

**Files to touch:**

- `src/utils/envHelper.ts` — add env vars per resource or use a single pair
- `src/middleware/writeRateLimiting.middleware.ts` — new file with factory function
- Admin route files — mount after `authenticatedRateLimiting`

**Estimated effort:** 25 minutes.

---

## 7. New Environment Variables Summary

Here is the full list of new env vars you would add:

```env
# Global IP rate limiting
RATE_LIMIT_GLOBAL_IP_LIMIT=100
RATE_LIMIT_GLOBAL_IP_WINDOW_MS=60000

# Registration IP rate limiting
RATE_LIMIT_REGISTER_IP_LIMIT=3
RATE_LIMIT_REGISTER_IP_WINDOW_MS=3600000

# Authenticated user rate limiting
RATE_LIMIT_USER_LIMIT=60
RATE_LIMIT_USER_WINDOW_MS=60000
```

All follow the same `z.coerce.number().int().positive().default(...)` pattern already established in `envHelper.ts`.

---

## 8. Testing Strategy

For each new limiter, the minimum test coverage should verify:

1. **Normal requests succeed** — send fewer than `limit` requests, all should return `200`
2. **Limit enforcement works** — send more than `limit` requests, the excess should return `429`
3. **`Retry-After` header is present** on `429` responses
4. **Redis-down behavior** — the limiter should fail open (bypass) when Redis is unavailable, not break the API
5. **Window expiry works** — after the window passes, requests should succeed again

The existing test patterns from the login/refresh limiter tests can be directly reused.

---

## 9. What You Should Learn From This

### A. Rate Limiting Is Layered, Not Monolithic

The mistake most projects make is adding one `express-rate-limit` middleware at the top level and calling it done. That covers volumetric abuse but misses:

- identity-aware abuse
- route-specific sensitivity
- the difference between reads and writes

This project now demonstrates a proper layered approach.

### B. The Global Limiter Is The Floor, Not The Ceiling

The global limiter should be the **most generous** limiter. It exists to catch things that route-specific limiters miss. If the global limiter is too tight, it will reject legitimate multi-page browsing before any specific limiter even gets a chance to run.

### C. Every Limiter Should Answer One Question

A well-designed limiter answers exactly one question:

| Limiter | Question |
|---|---|
| Global IP | "Is this IP sending too much traffic overall?" |
| Login IP | "Is this IP hammering the login page?" |
| Login Failure | "Is this identity failing authentication repeatedly?" |
| Refresh IP | "Is this IP abusing token refresh?" |
| Refresh Session | "Is this session refreshing too aggressively?" |
| Registration IP | "Is this IP creating too many accounts?" |
| User | "Is this user making too many API calls?" |
| Admin Write | "Is this user modifying admin resources too fast?" |

If a limiter tries to answer two questions at once, it usually means it should be split into two.

### D. Your `rateLimit.util.ts` Was Designed For This

The sliding-window utility is already generic. Every new limiter is just:

1. Pick a key format
2. Pick a limit and window
3. Call `allowSlidingWindow()`
4. Handle the result

That is the payoff of building a reusable utility instead of hand-coding each limiter separately.

---

## 10. Final Recommendation

Your instinct to add a global limiter and wrap up the rate-limiting feature is the right call.

If you implement just **Step 1 (Global) + Step 2 (Registration)**, you will have:

- every route in the app covered by at least one rate limiter
- auth-sensitive routes covered by multiple layers
- a clean, consistent pattern across all limiters
- a project that demonstrates real understanding of production rate-limiting architecture

Step 3 (Authenticated User) is a nice-to-have that rounds out the defense-in-depth story.

Step 4 (Admin Write) is only worth doing if you want to demonstrate that you can build configurable middleware factories — which is a good interview talking point but not a security necessity given the other layers.
