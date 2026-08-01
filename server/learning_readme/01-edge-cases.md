#### 1. When I get IP from req, am I getting IPv4 or IPv6?

You can get either. Modern systems often use IPv6, and Node.js frequently returns **IPv4-mapped IPv6** addresses (e.g., `::ffff:127.0.0.1`).

- `req.ip` returns the client IP based on your `trust proxy` settings.
- The `normalizeIpForRateLimit()` function handles this by stripping the `::ffff:` prefix to ensure consistent IPv4 strings for Redis keys.

#### 2. Why does the parser return boolean, number, and string?

The `parseTrustProxy` function in `app.ts` converts the `TRUST_PROXY` environment variable into a type Express understands:

- **Boolean**: `true` (trust all) or `false` (trust none).
- **Number**: Trusts a specific number of hops (e.g., `1` for one proxy).
- **String**: A specific IP or subnet (e.g., `'10.0.0.1'`).
  Express uses this to determine which IP in the `X-Forwarded-For` header is the "real" client IP.

#### 3. How does IP parsing help with shared IPs (Cloudflare WARP/VPNs)?

You are correct: pure IP-based rate limiting **cannot** distinguish between different users sharing the same egress IP (like Cloudflare WARP or a corporate NAT).

- **The Risk**: If one user on a shared IP fails login multiple times, everyone on that same IP might be blocked by the global IP limiter.
- **The Solution**: We use a multi-layered approach:
  1. **IP-only Limiter**: (Middleware) Prevents massive brute-force/DDoS from a single source.
  2. **Email + IP Hash**: (In `login.ts`) We create a unique signature using `hash(email + ip)`. This ensures that even if users share an IP, their failure limits are tracked per-account.
- **Malicious Hacker Scenario**: If a hacker has your password and is on your same VPN, they can indeed exhaust your limit. However, if they have your password, the rate limiter has already "failed" its primary job of stopping unauthorized access—its remaining job is to prevent further brute-forcing.

#### 4. What is happening in the Rate Limiting Lua script?

The Lua script implements a **Sliding Window** algorithm:

1. **Cleanup**: Removes timestamps older than the current window (`now - windowMs`) using `ZREMRANGEBYSCORE`.
2. **Check**: Counts the remaining entries using `ZCARD`. If `>= limit`, it calculates `retryAfterMs`.
3. **Record**: If under limit, it adds the current request (`ZADD`) with a unique member ID.
4. **Expiry**: Updates the key's TTL (`PEXPIRE`) to ensure Redis memory is eventually freed.

**Why Lua in a TS project?**

- **Atomicity**: Redis runs the entire script as one single operation. This prevents "Race Conditions" where two concurrent requests both think they are the "last allowed" request.
- **Performance**: Reduces network latency by combining multiple commands into a single round-trip to Redis.

#### 5. Function Explanations:

- **`normalizeIpForRateLimit()`**: Standardizes the IP string by removing IPv6-mapped IPv4 prefixes (`::ffff:`) so the Redis key is consistent.
- **`allowSlidingWindow()`**: The high-level wrapper that executes the Lua script. it coordinates the input (key, limit, window), calls Redis `eval`, and returns a `SlidingWindowResult` object.

#### 6. The "Shared IP" Problem (The Innocent User Scenario)

**Scenario**: Users B, C, D, and E are on the same VPN and exhaust the IP limit of 20. Innocent User A tries to log in and gets blocked.

**Is this handled?**
Currently, **User A will be blocked.** This is the "False Positive" risk of IP-based rate limiting.

**How to mitigate it:**

1. **Tiered Limits**: Set the IP-level limit (Middleware) to a "Broad" number (e.g., 200) to catch bots, while keeping the Account-level limit (Controller) "Tight" (e.g., 5) to catch password guessing.
2. **Advanced Identification**: In a production app, you would eventually use **Device Fingerprinting** or **Cookies** to distinguish between User A and User B even if they share an IP.
3. **Graceful Degradation**: Instead of a hard error, trigger a Captcha for that IP once the limit is reached.
