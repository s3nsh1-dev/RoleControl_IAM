import { after, before, beforeEach } from "node:test";
import app from "../../src/app.ts";
import { redisClient } from "../../src/config/redis.connect.ts";
import env from "../../src/utils/envHelper.ts";
import { pool } from "../../src/config/db.connect.ts";
import {
  resetDatabaseWithMigrations,
  seedReferenceRbac,
} from "../support/database.ts";
import { clearRateLimitRedisState } from "../support/redis.ts";
import { startTestServer } from "../support/http.ts";
import { setBaseUrl } from "./runtime.ts";

let closeServer: (() => Promise<void>) | null = null;
const originalTrustProxy = app.get("trust proxy");
const originalGlobalLimit = env.RATE_LIMIT_GLOBAL_IP_LIMIT;

before(async () => {
  app.set("trust proxy", true);
  env.RATE_LIMIT_GLOBAL_IP_LIMIT = 3;

  const testServer = await startTestServer();
  setBaseUrl(testServer.baseUrl);
  closeServer = async () =>
    await new Promise<void>((resolve, reject) => {
      testServer.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
});

after(async () => {
  app.set("trust proxy", originalTrustProxy);
  env.RATE_LIMIT_GLOBAL_IP_LIMIT = originalGlobalLimit;

  if (closeServer) {
    await closeServer();
  }
  await pool.end();
  if (redisClient.status === "ready") {
    await redisClient.quit();
  } else {
    redisClient.disconnect();
  }
});

beforeEach(async () => {
  await resetDatabaseWithMigrations();
  await seedReferenceRbac();
  await clearRateLimitRedisState();
});

await import("./rate-limit.cases.ts");
