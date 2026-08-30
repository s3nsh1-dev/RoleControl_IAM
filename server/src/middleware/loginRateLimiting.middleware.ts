import { asyncMiddleware } from "@/utils/asyncMiddleware.ts";
import env from "@/utils/envHelper.ts";
import {
  allowSlidingWindow,
  getTrustedClientIp,
  isRedisRateLimitReady,
  throwRateLimitError,
} from "@/utils/rateLimit.util.ts";

const loginRateLimiting = asyncMiddleware(async (req, res) => {
  const clientIp = getTrustedClientIp(req);
  const ipKey = `rate:login:ip:${clientIp}`;

  if (!isRedisRateLimitReady()) {
    console.warn("Redis is not ready. Bypassing login IP rate limiter.");
    return;
  }

  const ipCheck = await allowSlidingWindow(
    ipKey,
    env.RATE_LIMIT_LOGIN_IP_LIMIT,
    env.RATE_LIMIT_LOGIN_IP_WINDOW_MS,
  );

  if (!ipCheck) {
    console.warn("Login IP rate limiter degraded. Bypassing request.");
    return;
  }

  // sending AppError and retry header
  if (!ipCheck.allowed) {
    throwRateLimitError(
      res,
      ipCheck.retryAfterMs,
      "Too many login attempts from this IP. Please try again later.",
    );
  }
});

export { loginRateLimiting };
