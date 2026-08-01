import { after, before, beforeEach } from "node:test";
import { pool } from "../../src/config/db.connect.ts";
import {
  resetDatabaseWithMigrations,
  seedReferenceRbac,
} from "../support/database.ts";
import { startTestServer } from "../support/http.ts";
import { setBaseUrl } from "./runtime.ts";

let closeServer: (() => Promise<void>) | null = null;

before(async () => {
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
});

beforeEach(async () => {
  await resetDatabaseWithMigrations();
  await seedReferenceRbac();
});

await import("./schema.cases.ts");
await import("./app.cases.ts");
