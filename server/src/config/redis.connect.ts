import { Redis, RedisOptions } from "ioredis";
import env from "@/utils/envHelper.ts";

// Define connection options based on environment variables with local defaults
const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,

  // Production standard: robust retry strategy to handle temporary network blips
  retryStrategy(times) {
    // Reconnect after an increasing delay, capped at 2 seconds
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Initialize Redis Client (supports direct URL or host/port)
const redisClient = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      retryStrategy: redisOptions.retryStrategy,
    })
  : new Redis(redisOptions);

// Industry standard: Always attach lifecycle listeners.
// Otherwise, connection issues will fail silently or crash the app unexpectedly.
redisClient.on("connect", () => {
  console.log("Redis client connected");
});

redisClient.on("ready", () => {
  console.log("🟢 Redis client is ready to receive commands");
});

redisClient.on("error", (err) => {
  console.error("🔴 Redis client error:", err);
});

redisClient.on("reconnecting", () => {
  console.log("🟡 Redis client is reconnecting...");
});

export { redisClient };
