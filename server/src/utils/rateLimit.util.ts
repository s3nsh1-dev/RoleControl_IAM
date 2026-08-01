import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { redisClient } from "@/config/redis.connect.ts";
import { AppError } from "@/utils/AppError.ts";

const slidingWindowLuaScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = nowMs - windowMs

redis.call("ZREMRANGEBYSCORE", key, 0, windowStart)

local currentCount = redis.call("ZCARD", key)

if currentCount >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retryAfterMs = windowMs

  if oldest[2] then
    retryAfterMs = tonumber(oldest[2]) + windowMs - nowMs
  end

  if retryAfterMs < 1 then
    retryAfterMs = 1
  end

  redis.call("PEXPIRE", key, windowMs)

  return {0, currentCount, 0, retryAfterMs}
end

redis.call("ZADD", key, nowMs, member)
redis.call("PEXPIRE", key, windowMs)

local newCount = currentCount + 1

return {1, newCount, limit - newCount, 0}
`;

type SlidingWindowResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterMs: number;
};

const isRedisRateLimitReady = () => {
  return redisClient.status === "ready";
};

const normalizeIpForRateLimit = (ip: string) => {
  const normalizedIp = ip.trim();

  if (normalizedIp.startsWith("::ffff:")) {
    return normalizedIp.slice(7);
  }

  return normalizedIp;
};

const getTrustedClientIp = (req: Request) => {
  if (!req.ip) {
    throw AppError.badRequest("User IP not found");
  }

  return normalizeIpForRateLimit(req.ip);
};

const makeRateLimitMember = () => {
  return `${Date.now()}:${randomUUID()}`;
};

const allowSlidingWindow = async (
  key: string,
  limit: number,
  windowMs: number,
): Promise<SlidingWindowResult | null> => {
  if (!isRedisRateLimitReady()) {
    return null;
  }

  try {
    const result = (await redisClient.eval(
      slidingWindowLuaScript,
      1,
      key,
      String(limit),
      String(windowMs),
      String(Date.now()),
      makeRateLimitMember(),
    )) as [number | string, number | string, number | string, number | string];

    return {
      allowed: Number(result[0]) === 1,
      count: Number(result[1]),
      remaining: Number(result[2]),
      retryAfterMs: Number(result[3]),
    };
  } catch (error) {
    console.error("Rate limiter Redis check failed, bypassing:", error);
    return null;
  }
};

const clearRateLimitKey = async (key: string) => {
  if (!isRedisRateLimitReady()) {
    return;
  }

  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Failed to clear rate limit key:", error);
  }
};

const setRetryAfterHeader = (res: Response, retryAfterMs: number) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader("Retry-After", String(retryAfterSeconds));
};

const throwRateLimitError = (
  res: Response,
  retryAfterMs: number,
  message: string,
) => {
  setRetryAfterHeader(res, retryAfterMs);
  throw AppError.tooManyRequests(message);
};

export {
  allowSlidingWindow,
  clearRateLimitKey,
  getTrustedClientIp,
  isRedisRateLimitReady,
  throwRateLimitError,
};
export type { SlidingWindowResult };
