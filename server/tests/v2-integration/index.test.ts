import { after, before, beforeEach } from "node:test";
import { redisClient } from "../../src/config/redis.connect.ts";
import { pool } from "../../src/config/db.connect.ts";
import { resetDatabase, seedReferenceRbac } from "../support/database.ts";
import { startTestServer } from "../support/http.ts";
import {
  clearRateLimitRedisState,
  waitForRedisReady,
} from "../support/redis.ts";
import { setBaseUrl } from "./runtime.ts";

let closeServer: (() => Promise<void>) | null = null;

before(async () => {
  await waitForRedisReady();
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
  if (closeServer) {
    await closeServer();
  }
  await pool.end();
  if (redisClient.status === "ready" || redisClient.status === "connect") {
    await redisClient.quit();
  }
});

beforeEach(async () => {
  await resetDatabase();
  await seedReferenceRbac();
  await clearRateLimitRedisState();
});

await import("./auth.cases.ts");
await import("./users.cases.ts");
await import("./roles-permissions.cases.ts");
await import("./posts.cases.ts");
