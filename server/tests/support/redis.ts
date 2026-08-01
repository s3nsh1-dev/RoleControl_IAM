import { setTimeout as delay } from "node:timers/promises";
import { redisClient } from "../../src/config/redis.connect.ts";

const waitForRedisReady = async (timeoutMs = 5_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (redisClient.status === "ready") {
      return true;
    }

    await delay(100);
  }

  return redisClient.status === "ready";
};

const clearRateLimitRedisState = async () => {
  if (redisClient.status !== "ready") {
    return;
  }

  const keys = await redisClient.keys("rate:*");
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }
};

export { clearRateLimitRedisState, waitForRedisReady };
