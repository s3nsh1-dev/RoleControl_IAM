import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAuditLogCount,
  getUserSessions,
} from "../support/database.ts";
import { createClient } from "./helpers.ts";

test("migrated schema supports bootstrap registration, login, sessions, and protected routes", async () => {
  const client = createClient();
  const email = "migrated-root@example.com";
  const password = "secret123";

  const registrationResponse = await client.post("/api/auth/register", {
    body: {
      fullname: "Migrated Root",
      email,
      password,
    },
  });
  assert.equal(registrationResponse.status, 201);

  const registeredUser = registrationResponse.body?.["data"] as
    | { user?: { id: number; email: string } }
    | undefined;
  const userId = registeredUser?.user?.id;
  assert.equal(registeredUser?.user?.email, email);
  assert.ok(userId, "Expected registration to return the new user id");

  const loginResponse = await client.post("/api/auth/login", {
    body: { email, password },
  });
  assert.equal(loginResponse.status, 200);
  assert.equal(client.hasCookie("access"), true);
  assert.equal(client.hasCookie("refresh"), true);

  const sessions = await getUserSessions(userId!);
  assert.equal(sessions.length, 1);

  const usersResponse = await client.get("/api/users");
  assert.equal(usersResponse.status, 200);
  assert.equal(usersResponse.body?.["success"], true);

  const createUserAuditCount = await getAuditLogCount("create", "user", userId!);
  assert.equal(
    createUserAuditCount,
    1,
    "Expected registration on migrated schema to write the user audit row",
  );
});
