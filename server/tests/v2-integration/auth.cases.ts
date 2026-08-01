import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDirectUser,
  expireSessionDirectly,
  getUserSessions,
  revokeSessionDirectly,
} from "../support/database.ts";
import {
  assertErrorResponse,
  createClient,
  getResponseData,
  loginAsUser,
} from "./helpers.ts";

test("auth me returns the current user roles and view-named capabilities", async () => {
  const user = await createDirectUser({
    fullname: "Capability User",
    email: "capability-user@example.com",
    password: "secret123",
    roles: ["admin", "user"],
  });
  const client = await loginAsUser(user);

  const response = await client.get("/api/auth/me");
  assert.equal(response.status, 200);

  const data = getResponseData<{
    user: { id: number; email: string };
    roles: string[];
    capabilities: string[];
  }>(response);

  assert.equal(data.user.id, user.id);
  assert.equal(data.user.email, user.email);
  assert.deepEqual(data.roles.sort(), ["admin", "user"]);
  assert.ok(data.capabilities.includes("users.view"));
  assert.ok(data.capabilities.includes("roles.view"));
  assert.ok(data.capabilities.includes("permissions.view"));
  assert.ok(data.capabilities.includes("posts.create"));
  assert.ok(data.capabilities.includes("users.assignRole"));
  assert.ok(data.capabilities.includes("users.revokeRole"));
  assert.ok(data.capabilities.includes("rolePermissions.view"));
  assert.equal(
    data.capabilities.some((capability) => capability.endsWith(".read")),
    false,
    "Capabilities should use view naming, not read naming",
  );
});

test("registration is allowed once for the first super-admin", async () => {
  const client = createClient();

  const firstRegistration = await client.post("/api/auth/register", {
    body: {
      fullname: "Root Admin",
      email: "root@example.com",
      password: "secret123",
    },
  });
  assert.equal(firstRegistration.status, 201);
  assert.equal(firstRegistration.body?.["success"], true);

  const secondRegistration = await client.post("/api/auth/register", {
    body: {
      fullname: "Another Root",
      email: "another-root@example.com",
      password: "secret123",
    },
  });
  assertErrorResponse(
    secondRegistration,
    403,
    /already initialized with a super-admin/i,
  );
});

test("login failures are descriptive and do not create session rows", async () => {
  const user = await createDirectUser({
    fullname: "Auth User",
    email: "auth-user@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = createClient();

  const wrongPassword = await client.post("/api/auth/login", {
    body: { email: user.email, password: "wrong-password" },
  });
  assertErrorResponse(wrongPassword, 401, /invalid email or password/i);
  assert.equal(
    (await getUserSessions(user.id)).length,
    0,
    "Wrong-password login should not create a session row",
  );

  const missingUser = await client.post("/api/auth/login", {
    body: { email: "missing-user@example.com", password: "secret123" },
  });
  assertErrorResponse(missingUser, 401, /invalid email or password/i);
  assert.equal(
    (await getUserSessions(user.id)).length,
    0,
    "Missing-user login should not create a session row for existing users either",
  );
});

test("login rate limiting blocks repeated failed attempts for the same email and IP", async () => {
  const user = await createDirectUser({
    fullname: "Rate Limited Login User",
    email: "rate-limited-login@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = createClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await client.post("/api/auth/login", {
      body: { email: user.email, password: "wrong-password" },
    });
    assertErrorResponse(response, 401, /invalid email or password/i);
  }

  const blockedResponse = await client.post("/api/auth/login", {
    body: { email: user.email, password: "wrong-password" },
  });
  assertErrorResponse(
    blockedResponse,
    429,
    /too many failed login attempts/i,
  );
  assert.match(
    String(blockedResponse.headers.get("retry-after")),
    /^\d+$/,
    "Expected login limiter to return Retry-After",
  );
});

test("login rate limiting blocks repeated login requests from the same IP", async () => {
  const client = createClient();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await client.post("/api/auth/login", {
      body: {
        email: `missing-ip-${attempt}@example.com`,
        password: "secret123",
      },
    });
    assertErrorResponse(response, 401, /invalid email or password/i);
  }

  const blockedResponse = await client.post("/api/auth/login", {
    body: {
      email: "missing-ip-blocked@example.com",
      password: "secret123",
    },
  });
  assertErrorResponse(
    blockedResponse,
    429,
    /too many login attempts from this ip/i,
  );
  assert.match(
    String(blockedResponse.headers.get("retry-after")),
    /^\d+$/,
    "Expected login IP limiter to return Retry-After",
  );
});

test("refresh rotates the session hash and rejects replay of the old refresh token", async () => {
  const user = await createDirectUser({
    fullname: "Rotate User",
    email: "rotate-user@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(user);

  const initialSessions = await getUserSessions(user.id);
  assert.equal(initialSessions.length, 1);
  const firstSession = initialSessions[0]!;
  const oldRefreshToken = client.getCookie("refresh");
  assert.ok(oldRefreshToken, "Expected the client to hold the initial refresh cookie");

  // JWTs are issued with second-level timestamps, so rotating too quickly can
  // produce the same token string and hide the replay protection behavior.
  await new Promise((resolve) => setTimeout(resolve, 1_100));

  const refreshResponse = await client.get("/api/auth/refresh");
  assert.equal(refreshResponse.status, 200);

  const rotatedSessions = await getUserSessions(user.id);
  assert.equal(rotatedSessions.length, 1);
  assert.equal(rotatedSessions[0]?.id, firstSession.id);
  assert.notEqual(
    rotatedSessions[0]?.refresh_token_hash,
    firstSession.refresh_token_hash,
  );

  client.setCookie("refresh", oldRefreshToken!);
  const replayResponse = await client.get("/api/auth/refresh");
  assertErrorResponse(replayResponse, 401, /invalid refresh token/i);
});

test("refresh rate limiting blocks repeated refresh attempts for the same session", async () => {
  const user = await createDirectUser({
    fullname: "Refresh Limited User",
    email: "refresh-limited@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(user);
  const originalRefreshToken = client.getCookie("refresh");

  assert.ok(
    originalRefreshToken,
    "Expected to capture the original refresh cookie for replay attempts",
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
    client.setCookie("refresh", originalRefreshToken!);
    const response = await client.get("/api/auth/refresh");

    if (attempt === 0) {
      assert.equal(response.status, 200);
      continue;
    }

    assert.ok(
      response.status === 200 || response.status === 401,
      `Expected refresh attempts before the limiter to stay below 429, received ${response.status}`,
    );
  }

  client.setCookie("refresh", originalRefreshToken!);
  const blockedResponse = await client.get("/api/auth/refresh");
  assertErrorResponse(
    blockedResponse,
    429,
    /too many refresh attempts for this session/i,
  );
  assert.match(
    String(blockedResponse.headers.get("retry-after")),
    /^\d+$/,
    "Expected refresh session limiter to return Retry-After",
  );
});

test("refresh rejects directly revoked sessions with a descriptive message", async () => {
  const user = await createDirectUser({
    fullname: "Revoked Session User",
    email: "revoked-session@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(user);
  const sessions = await getUserSessions(user.id);
  assert.equal(sessions.length, 1);

  assert.equal(
    await revokeSessionDirectly(sessions[0]!.id),
    true,
    "Expected test helper to revoke the session row",
  );

  const refreshResponse = await client.get("/api/auth/refresh");
  assertErrorResponse(refreshResponse, 401, /session revoked/i);
});

test("refresh rejects directly expired sessions with a descriptive message", async () => {
  const user = await createDirectUser({
    fullname: "Expired Session User",
    email: "expired-session@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(user);
  const sessions = await getUserSessions(user.id);
  assert.equal(sessions.length, 1);

  assert.equal(
    await expireSessionDirectly(sessions[0]!.id),
    true,
    "Expected test helper to expire the session row",
  );

  const refreshResponse = await client.get("/api/auth/refresh");
  assertErrorResponse(refreshResponse, 401, /session expired/i);
});

test("logout is idempotent and clears client cookies", async () => {
  const user = await createDirectUser({
    fullname: "Logout User",
    email: "logout-user@example.com",
    password: "secret123",
    roles: ["user"],
  });

  const noCookieClient = createClient();
  const firstLogout = await noCookieClient.post("/api/auth/logout");
  assert.equal(firstLogout.status, 200);
  assert.equal(noCookieClient.hasCookie("access"), false);
  assert.equal(noCookieClient.hasCookie("refresh"), false);

  const client = await loginAsUser(user);
  const activeSessions = await getUserSessions(user.id);
  assert.equal(activeSessions.length, 1);

  const logoutResponse = await client.post("/api/auth/logout");
  assert.equal(logoutResponse.status, 200);
  assert.equal(client.hasCookie("access"), false);
  assert.equal(client.hasCookie("refresh"), false);

  const revokedSessions = await getUserSessions(user.id);
  assert.equal(revokedSessions.length, 1);
  assert.ok(revokedSessions[0]?.revoked_at, "Expected logout to revoke the session row");

  const secondLogout = await client.post("/api/auth/logout");
  assert.equal(secondLogout.status, 200);
});

test("login enforces the max two session rows per user cap", async () => {
  const user = await createDirectUser({
    fullname: "Cap User",
    email: "cap-user@example.com",
    password: "secret123",
    roles: ["user"],
  });

  const firstClient = createClient();
  const secondClient = createClient();
  const thirdClient = createClient();

  const firstLogin = await firstClient.post("/api/auth/login", {
    body: { email: user.email, password: "secret123" },
  });
  assert.equal(firstLogin.status, 200);

  const sessionsAfterFirstLogin = await getUserSessions(user.id);
  assert.equal(sessionsAfterFirstLogin.length, 1);
  const oldestSessionId = sessionsAfterFirstLogin[0]!.id;

  const secondLogin = await secondClient.post("/api/auth/login", {
    body: { email: user.email, password: "secret123" },
  });
  assert.equal(secondLogin.status, 200);

  const thirdLogin = await thirdClient.post("/api/auth/login", {
    body: { email: user.email, password: "secret123" },
  });
  assert.equal(thirdLogin.status, 200);

  const sessionsAfterThirdLogin = await getUserSessions(user.id);
  assert.equal(sessionsAfterThirdLogin.length, 2);
  assert.ok(
    sessionsAfterThirdLogin.every((session) => session.id !== oldestSessionId),
    "Expected the oldest session to be evicted once the cap is exceeded",
  );
});

test("protected routes reject requests without a valid access cookie", async () => {
  const client = createClient();

  const usersResponse = await client.get("/api/users");
  assertErrorResponse(usersResponse, 401, /invalid user session/i);

  const createPostResponse = await client.post("/api/posts", {
    body: { title: "Unauthenticated", content: "Denied" },
  });
  assertErrorResponse(createPostResponse, 401, /invalid user session/i);
});
