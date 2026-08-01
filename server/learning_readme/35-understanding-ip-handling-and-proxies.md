# IP Handling, Proxies, and Rate Limiting: A Deep Dive

This document serves as the definitive, one-stop guide for understanding how our backend application handles IP addresses. It covers the complexities of shared IP addresses, Network Address Translation (NAT), commercial VPNs (like Cloudflare WARP), the critical role of `TRUST_PROXY`, and why we rigorously normalize ("clean") IP addresses.

---

## 1. The Shared IP Problem: NAT and VPNs

When building web applications, developers often assume that `1 IP Address = 1 Unique User`. **This is fundamentally false.** Modern network infrastructure guarantees that a single public IP address will frequently represent dozens, hundreds, or even thousands of unique human users.

### Real-World Scenarios
1. **The Corporate Office (NAT - Network Address Translation):**
   Imagine a corporate building with 500 employees. Internally, each computer has a private IP (e.g., `192.168.1.50`). However, when these computers access the internet, the office router translates all their requests to originate from a *single* Public IP address assigned by their ISP (e.g., `203.0.113.45`). To our Node.js server, all 500 employees look exactly the same.
2. **Cloudflare WARP and Commercial VPNs:**
   When you activate Cloudflare WARP on your phone or PC, your device connects to Cloudflare's edge network. Cloudflare then forwards your traffic to our server. As a result, our server sees the IP of the Cloudflare Edge Server, not your physical device. Because millions of users use WARP, you might be sharing that exact Cloudflare IP with thousands of other unrelated users simultaneously.

### The Rate Limiting Dilemma: "The Noisy Neighbor"
If we implement rate limiting purely based on the user's IP address, we run into the "Noisy Neighbor" problem:
- If **one** employee in the corporate office tries to brute-force a password, the rate limiter triggers on `203.0.113.45` and blocks the **entire office** of 500 people from accessing the app.
- If **one** Cloudflare WARP user spams the API, thousands of other innocent WARP users sharing that edge IP are also blocked.

### How Our Codebase Solves This

#### A. The Login Rate Limiter (The Stricter Solution)
Login endpoints (`/api/auth/login`) are the highest-risk targets for brute-force attacks, so they require strict rate limiting. To avoid blocking entire offices, we **do not** rate-limit solely by IP.

*Code snippet from `src/controllers/auth/login.ts`:*
```typescript
const buildLoginFailureKey = (email: string, ip: string) => {
  const hashedIdentity = hashSha256(`${email}|${ip}`);
  return `rate:login:fail:email-ip:${hashedIdentity}`;
};
```
By creating a composite key of `IP + Email`, we ensure that:
- If Alice (`alice@company.com`) and Bob (`bob@company.com`) are in the same office (same IP), their rate-limiting buckets are completely isolated. Bob failing his password 10 times will not affect Alice's ability to log in.
- If an attacker uses the office IP to try and brute-force *only* the admin account (`admin@company.com`), that specific attack vector is shut down without taking the application offline for the rest of the company.

#### B. The Global Rate Limiter (The Compromise Solution)
For general API requests, tracking composite keys for unauthenticated users is mathematically complex and memory-intensive. Therefore, our global rate limiter *does* rely purely on the IP address.

*Code snippet from `src/middleware/globalRateLimiting.middleware.ts`:*
```typescript
const ipKey = `rate:global:ip:${clientIp}`;
const ipCheck = await allowSlidingWindow(ipKey, env.RATE_LIMIT_GLOBAL_IP_LIMIT, windowMs);
```
**The Mitigation:** Because we know this is a shared IP, we deliberately set `RATE_LIMIT_GLOBAL_IP_LIMIT` generously high in production. It must be high enough to accommodate a medium-sized office using the application simultaneously, while still acting as a fail-safe against aggressive DDoS attacks or scraper bots.

---

## 2. The Reverse Proxy Dilemma: What is `TRUST_PROXY`?

When a Node.js application is deployed to production, it is rarely exposed directly to the open internet. It sits behind a "Reverse Proxy" or a Load Balancer (e.g., Nginx, AWS Application Load Balancer, or Cloudflare DNS Proxy).

### The Problem
The network flow looks like this:
`User (IP: 104.20.12.5)  ->  Cloudflare Proxy (IP: 172.64.0.1)  ->  Your Node.js Server`

Because the Cloudflare server is the machine *actually* making the TCP connection to Node.js, Express will populate `req.ip` with `172.64.0.1`. 
**If we don't fix this, Node.js will think every single user in the world is connecting from `172.64.0.1`**, and our global rate limiter will block the entire world after a few seconds of traffic.

### The Solution: `X-Forwarded-For` and `TRUST_PROXY`
To solve this, reverse proxies inject a special HTTP header before forwarding the request to Node.js:
`X-Forwarded-For: 104.20.12.5`

However, Express ignores this header by default because HTTP headers can be easily faked by hackers. If a hacker sends a fake `X-Forwarded-For` header directly to a naked Node.js server, they can bypass IP rate limits entirely.

*Code snippet from `src/app.ts`:*
```typescript
app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY));
```

By defining `TRUST_PROXY=true` in our `.env` file, we explicitly tell Express: 
> *"I guarantee this application is running behind a trusted reverse proxy. You can safely ignore the direct TCP connection IP and extract the true user IP from the `X-Forwarded-For` header."*

*(Note: If you run this app locally on your laptop without a reverse proxy, `TRUST_PROXY` should be `false` to prevent header spoofing).*

---

## 3. IP Normalization: "Cleaning" the IP Address

Once we successfully extract the user's IP, we pass it through a normalization function before using it as a rate-limiting key.

*Code snippet from `src/utils/rateLimit.util.ts`:*
```typescript
const normalizeIpForRateLimit = (ip: string) => {
  const normalizedIp = ip.trim();

  // Strip IPv4-mapped IPv6 prefix
  if (normalizedIp.startsWith("::ffff:")) {
    return normalizedIp.slice(7);
  }

  return normalizedIp;
};
```

### The IPv4 vs IPv6 Translation Quirk
Internet protocols use both IPv4 (e.g., `192.168.1.5`) and IPv6 (e.g., `2001:0db8::ff00:42:8329`). 

Modern operating systems and Node.js often run on "dual-stack" networks that translate IPv4 traffic over an IPv6 interface. When an IPv4 connection is mapped over IPv6 infrastructure, the networking stack attaches an IPv6 prefix, transforming `192.168.1.5` into `::ffff:192.168.1.5`.

**The Vulnerability:**
In programming, the string `"192.168.1.5"` does not equal `"::ffff:192.168.1.5"`. 
If a user connects to our server natively over IPv4, their rate-limiting bucket is tied to the first string. If their device reconnects, and the network routing slightly alters to pass through an IPv6 translation layer, their IP registers as the second string. 

Because the strings are different, the rate limiter would see them as a brand new user and grant them a fresh bucket of requests. A sophisticated attacker could manipulate their network routing to toggle this prefix and double their rate-limit allowance.

By stripping the `::ffff:` prefix during normalization, we guarantee that the underlying IP is evaluated consistently every single time, ensuring our rate limits cannot be bypassed by network quirks.
