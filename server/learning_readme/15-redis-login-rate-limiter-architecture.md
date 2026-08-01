# Redis Login Rate Limiting Architecture For This Project

This note turns the earlier Redis and rate-limiting analysis into one concrete implementation design for this project's auth routes.

Project shape assumed here:

- Express + TypeScript
- PostgreSQL as source of truth
- JWT access + refresh cookies
- `user_sessions` stored in PostgreSQL
- login flow in `src/controllers/auth/login.ts`
- auth routes mounted in `src/routes/auth.route.ts`

This document is intentionally focused on the login limiter first.
You said you will handle the other auth routes yourself, so this note gives the best algorithm and architecture for `/api/auth/login`.

## 1. Best Algorithm For This Project

Use a Redis-backed sliding window limiter implemented with:

- Redis `ZSET`
- one member per attempt
- score = current timestamp in milliseconds
- atomic check/update through a Lua script

This is the best fit for this project because:

- login is security-sensitive, so boundary bursts from fixed windows are not ideal
- login traffic should be relatively low, so `ZSET` cardinality stays small
- Redis is already the right place for short-lived counters and abuse-control state
- this works correctly across multiple app instances
- it is stricter and fairer than fixed-window counting
- it is simpler to reason about for auth abuse than token bucket

## 2. Why This Algorithm Is Better Than The Other Common Choices

### Fixed Window

Not the best choice here because:

- a client can burst at the end of one window and the start of the next
- that is exactly the kind of edge case you do not want on login

### Token Bucket

Good for general traffic shaping, but not the best first login limiter because:

- it allows controlled bursts by design
- login brute-force defense usually wants stricter attempt counting

### Sliding Window Log With `ZSET`

Best here because:

- it enforces "N attempts in the last X minutes" exactly
- it avoids fixed-window burst edges
- the data is temporary and tiny for login routes
- it maps cleanly to Redis expiry and distributed middleware

## 3. What To Limit On Login

Do not use only one key.

For this project, the best login design is two layers:

1. A coarse IP limiter that counts every login request.
2. A stricter failed-login limiter keyed by `email + IP`.

Why this is better than only IP:

- one abusive IP gets blocked quickly
- shared IPs are less likely to hurt legitimate users

Why this is better than only email:

- pure email-only lockouts are easy to weaponize for denial-of-service against a known account

Why `email + IP` is the right second key:

- it is tight enough to slow real brute-force attempts
- it reduces accidental cross-user lockouts on shared networks
- it avoids turning a known email into a globally lockable target

## 4. Recommended Login Thresholds

Good starting values for this project:

- IP limiter: `20 requests / 15 minutes`
- failed login limiter by `email + IP`: `5 failed attempts / 15 minutes`

Optional hardening later:

- if the `email + IP` limiter trips, create a short lock key for `15 minutes`
- if one IP keeps hitting many emails, add a higher-level IP abuse threshold

These values are reasonable starting points, not permanent truth.
Make them environment-driven.

## 5. Best Redis Key Design

Use readable keys, but do not store raw email addresses in Redis keys.

Recommended shapes:

- `rate:login:ip:<ip>`
- `rate:login:fail:email-ip:<hash>`
- `lock:login:email-ip:<hash>`

Where:

- `<ip>` is the trusted client IP
- `<hash>` = `sha256(lowercase(trim(email)) + "|" + ip + "|" + server_secret)`

Why hash the email-based key:

- Redis keys become safer to inspect in logs and dashboards
- you avoid leaking account identifiers through infrastructure metadata

## 6. Exact Pseudocode For The Core Sliding Window Algorithm

This is the reusable Redis-side algorithm.

```text
function slidingWindowAllow(key, limit, windowMs, nowMs, requestId):
    windowStart = nowMs - windowMs

    # Remove attempts older than the rolling window
    ZREMRANGEBYSCORE key 0 windowStart

    currentCount = ZCARD key

    if currentCount >= limit:
        oldest = ZRANGE key 0 0 WITHSCORES
        retryAfterMs = (oldest.score + windowMs) - nowMs
        if retryAfterMs < 0:
            retryAfterMs = 1000

        PEXPIRE key windowMs

        return {
            allowed: false,
            count: currentCount,
            remaining: 0,
            retryAfterMs: retryAfterMs
        }

    ZADD key nowMs requestId
    PEXPIRE key windowMs

    newCount = currentCount + 1

    return {
        allowed: true,
        count: newCount,
        remaining: limit - newCount,
        retryAfterMs: 0
    }
```

### Important Implementation Detail

This should be executed atomically.

Best implementation:

- wrap the logic in one Lua script

Why:

- two concurrent requests for the same key should not both pass incorrectly
- Redis Lua gives you atomic read-modify-write behavior

## 7. Pseudocode To Implement The Login Rate Limiter

This is the login-specific flow that fits your current controller shape.

```text
function loginRateLimitMiddleware(req, res, next):
    ip = getTrustedClientIp(req)
    email = normalizeEmail(req.body.email or "")
    nowMs = currentTimeMillis()

    ipKey = "rate:login:ip:" + ip
    ipCheck = slidingWindowAllow(
        key = ipKey,
        limit = LOGIN_IP_LIMIT,
        windowMs = LOGIN_IP_WINDOW_MS,
        nowMs = nowMs,
        requestId = randomUuid()
    )

    if ipCheck.allowed is false:
        return respond429(
            res,
            message = "Too many login attempts from this IP. Please try again later.",
            retryAfterMs = ipCheck.retryAfterMs
        )

    req.rateLimitContext = {
        ip: ip,
        email: email
    }

    next()
```

Then inside login handling:

```text
function authLoginController(req, res):
    ip = req.rateLimitContext.ip
    email = req.rateLimitContext.email
    emailIpHash = hash(email + "|" + ip + "|" + RATE_LIMIT_SECRET)
    failKey = "rate:login:fail:email-ip:" + emailIpHash
    lockKey = "lock:login:email-ip:" + emailIpHash

    if EXISTS lockKey:
        ttlMs = PTTL lockKey
        return respond429(
            res,
            message = "Too many failed login attempts. Please try again later.",
            retryAfterMs = ttlMs
        )

    user = findUserByEmail(email)
    if user does not exist:
        failCheck = slidingWindowAllow(
            key = failKey,
            limit = LOGIN_FAIL_LIMIT,
            windowMs = LOGIN_FAIL_WINDOW_MS,
            nowMs = currentTimeMillis(),
            requestId = randomUuid()
        )

        if failCheck.allowed is false:
            SET lockKey "1" PX failCheck.retryAfterMs
            return respond429(res, "Too many failed login attempts. Please try again later.")

        return respond401(res, "Invalid email or password")

    passwordMatches = comparePassword(req.body.password, user.passwordHash)
    if passwordMatches is false:
        failCheck = slidingWindowAllow(
            key = failKey,
            limit = LOGIN_FAIL_LIMIT,
            windowMs = LOGIN_FAIL_WINDOW_MS,
            nowMs = currentTimeMillis(),
            requestId = randomUuid()
        )

        if failCheck.allowed is false:
            SET lockKey "1" PX failCheck.retryAfterMs
            return respond429(res, "Too many failed login attempts. Please try again later.")

        return respond401(res, "Invalid email or password")

    DEL failKey
    DEL lockKey

    continue with existing session creation + JWT issue flow
```

## 8. Why This Login Flow Is The Best Fit Here

Because it separates two different problems:

- IP limiter protects the route and PostgreSQL from noisy traffic before expensive work
- failed `email + IP` limiter protects against password guessing without creating a global account lockout

That matches your current login controller well because `src/controllers/auth/login.ts` does:

- body parse and validation
- DB lookup by email
- password hash comparison
- session creation
- JWT issuance

The limiter should stop bad traffic before repeated DB work and before repeated password hash checks.

## 9. Where This Fits In Your Current Architecture

### Request Order

Recommended order for `/api/auth/login`:

1. `express.json()` parses body
2. login rate-limit middleware extracts trusted IP and normalized email
3. middleware checks Redis IP limiter
4. controller performs existing login logic
5. on auth failure, controller updates failed-attempt limiter
6. on success, controller clears failed-attempt state

### Why Not Put Everything In One Middleware

Because the failed-attempt limiter needs to know whether the login actually failed.

That means:

- pre-check belongs in middleware
- failure increment belongs close to the auth result

## 10. Best Middleware And Utility Split

For this project, the cleanest split is:

- `redis.connect.ts`
  - owns Redis client creation and lifecycle
- `rateLimit.redis.ts`
  - owns Lua script and generic `slidingWindowAllow(...)`
- `loginRateLimit.middleware.ts`
  - pre-checks IP limiter and stores request context
- `auth/login.ts`
  - increments failed `email + IP` limiter on invalid credentials
  - clears the failed key on successful login

This keeps:

- Redis concerns isolated
- middleware reusable
- auth controller still responsible for auth outcome

## 11. Trusted IP Handling Matters

Right now `src/app.ts` does not configure proxy trust.

If this app runs behind:

- Nginx
- a cloud load balancer
- Render / Railway / Fly / Heroku-style proxy

then the limiter can be wrong unless Express trusts the proxy.

That means in deployment you should configure:

- `app.set("trust proxy", 1)` or the correct proxy depth

Without this, your IP limiter may see only the proxy IP and rate-limit everyone together.

## 12. Response Shape And Headers

When blocked, return:

- status: `429`
- message: clear and auth-specific

Recommended body:

```json
{
  "success": false,
  "message": "Too many login attempts. Please try again later."
}
```

Recommended headers:

- `Retry-After`
- optionally `X-RateLimit-Limit`
- optionally `X-RateLimit-Remaining`

`Retry-After` is the most useful one.

## 13. Failure Policy If Redis Is Down

For this project, use fail-open first.

That means:

- if Redis rate limiting fails unexpectedly
- log the event
- allow the login request to continue

Why this is the best first choice here:

- auth availability is more important than temporarily losing throttling
- this project uses PostgreSQL as auth truth, not Redis as auth truth
- it keeps Redis an infrastructure helper, not a hard dependency for login correctness

If this later becomes an internet-facing production service with active abuse pressure, you can revisit this.

## 14. Operational Notes

Keep these settings in env:

- `REDIS_URL`
- `RATE_LIMIT_SECRET`
- `LOGIN_IP_LIMIT`
- `LOGIN_IP_WINDOW_MS`
- `LOGIN_FAIL_LIMIT`
- `LOGIN_FAIL_WINDOW_MS`

Also log:

- blocked IP
- limiter type that fired
- retry-after duration
- maybe normalized reason like `ip_limit` or `email_ip_fail_limit`

Do not log raw passwords.
Avoid logging raw email if you do not need it.

## 15. Final Recommendation

If you want the best practical login limiter for this RBAC project, implement this:

- Redis-backed sliding window limiter using `ZSET`
- atomic Lua script for check/update
- one coarse IP limiter for every login request
- one failed-attempt limiter keyed by `email + IP`
- clear failed-attempt key on successful login
- fail open if Redis is unavailable

That is the best balance of:

- correctness
- security
- fairness
- distributed behavior
- implementation complexity

For this project, this is stronger than fixed-window counting and more appropriate than token bucket for the login route.
