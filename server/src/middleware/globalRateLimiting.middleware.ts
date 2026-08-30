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
    console.warn("Redis is not ready. Bypassing global API rate limiter.");
    return;
  }

  const ipCheck = await allowSlidingWindow(
    ipKey,
    env.RATE_LIMIT_GLOBAL_IP_LIMIT,
    env.RATE_LIMIT_GLOBAL_IP_WINDOW_MS,
  );

  if (!ipCheck) {
    console.warn("Global API rate limiter degraded. Bypassing request.");
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
