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
