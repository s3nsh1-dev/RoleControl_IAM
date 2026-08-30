import { asyncMiddleware } from "@/utils/asyncMiddleware.ts";
import env from "@/utils/envHelper.ts";
import {
  allowSlidingWindow,
  getTrustedClientIp,
  isRedisRateLimitReady,
  throwRateLimitError,
} from "@/utils/rateLimit.util.ts";

const refreshRateLimiting = asyncMiddleware(async (req, res) => {
  const clientIp = getTrustedClientIp(req);
  const ipKey = `rate:refresh:ip:${clientIp}`;

  if (!isRedisRateLimitReady()) {
    console.warn("Redis is not ready. Bypassing refresh IP rate limiter.");
    return;
  }

  const ipCheck = await allowSlidingWindow(
    ipKey,
    env.RATE_LIMIT_REFRESH_IP_LIMIT,
    env.RATE_LIMIT_REFRESH_IP_WINDOW_MS,
  );

  if (!ipCheck) {
    console.warn("Refresh IP rate limiter degraded. Bypassing request.");
    return;
  }

  if (!ipCheck.allowed) {
    throwRateLimitError(
      res,
      ipCheck.retryAfterMs,
      "Too many refresh attempts from this IP. Please try again later.",
    );
  }
});

export { refreshRateLimiting };
