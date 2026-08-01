import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { pool } from "../../src/config/db.connect.ts";
import {
  createDirectUser,
  getAuditLogCount,
  getUserSessions,
  resetDatabase,
  seedReferenceRbac,
} from "../support/database.ts";
import { CookieClient, startTestServer } from "../support/http.ts";

let baseUrl = "";
let closeServer: (() => Promise<void>) | null = null;

before(async () => {
  const testServer = await startTestServer();
  baseUrl = testServer.baseUrl;
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
  await resetDatabase();
  await seedReferenceRbac();
});

test("bootstrap registration is allowed once for the first super-admin", async () => {
  const client = new CookieClient(baseUrl);

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
  assert.equal(secondRegistration.status, 403);
  assert.match(
    String(secondRegistration.body?.["message"]),
    /already initialized with a super-admin/i,
  );
});

test("login, refresh, and logout manage a DB-backed session lifecycle", async () => {
  const user = await createDirectUser({
    fullname: "Auth User",
    email: "auth-user@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = new CookieClient(baseUrl);

  const loginResponse = await client.post("/api/auth/login", {
    body: { email: user.email, password: "secret123" },
  });
  assert.equal(loginResponse.status, 200);
  assert.ok(client.getCookie("access"));
  assert.ok(client.getCookie("refresh"));

  const sessionsAfterLogin = await getUserSessions(user.id);
  assert.equal(sessionsAfterLogin.length, 1);
  assert.equal(sessionsAfterLogin[0]?.revoked_at, null);
  const firstSession = sessionsAfterLogin[0]!;

  const refreshResponse = await client.get("/api/auth/refresh");
  assert.equal(refreshResponse.status, 200);

  const sessionsAfterRefresh = await getUserSessions(user.id);
  assert.equal(sessionsAfterRefresh.length, 1);
  assert.equal(sessionsAfterRefresh[0]?.id, firstSession.id);
  assert.notEqual(
    sessionsAfterRefresh[0]?.refresh_token_hash,
    firstSession.refresh_token_hash,
  );

  const logoutResponse = await client.post("/api/auth/logout");
  assert.equal(logoutResponse.status, 200);

  const sessionsAfterLogout = await getUserSessions(user.id);
  assert.equal(sessionsAfterLogout.length, 1);
  assert.ok(sessionsAfterLogout[0]?.revoked_at);

  const refreshAfterLogout = await client.get("/api/auth/refresh");
  assert.equal(refreshAfterLogout.status, 401);
});

test("login enforces the max two session rows per user cap", async () => {
  const user = await createDirectUser({
    fullname: "Cap User",
    email: "cap-user@example.com",
    password: "secret123",
    roles: ["user"],
  });

  const firstClient = new CookieClient(baseUrl);
  const secondClient = new CookieClient(baseUrl);
  const thirdClient = new CookieClient(baseUrl);

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
  );
});

test("route aliases and protected RBAC surfaces work through the mounted API", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Super Admin",
    email: "super-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const client = new CookieClient(baseUrl);

  const loginResponse = await client.post("/api/auth/login", {
    body: { email: superAdmin.email, password: "secret123" },
  });
  assert.equal(loginResponse.status, 200);

  const createUserResponse = await client.post("/api/users", {
    body: {
      fullname: "Editor User",
      email: "editor-user@example.com",
      password: "secret123",
      rName: "editor",
    },
  });
  assert.equal(createUserResponse.status, 201);
  const createdUserId = Number(
    ((createUserResponse.body?.["data"] as { user: { id: number } })?.user.id),
  );

  const viewUserResponse = await client.get(`/api/users/${createdUserId}`);
  assert.equal(viewUserResponse.status, 200);

  const updateUserResponse = await client.put(`/api/users/${createdUserId}`, {
    body: { fullname: "Editor User Updated" },
  });
  assert.equal(updateUserResponse.status, 200);

  const assignRoleResponse = await client.post(
    `/api/user-roles/${createdUserId}`,
    {
      body: { rName: "user" },
    },
  );
  assert.equal(assignRoleResponse.status, 201);

  const assignPermissionResponse = await client.post("/api/role-permissions", {
    body: { rName: "admin", action: "update", resource: "post" },
  });
  assert.equal(assignPermissionResponse.status, 201);

  const listRolePermissionsResponse = await client.get("/api/role-permissions");
  assert.equal(listRolePermissionsResponse.status, 200);
  const rolePermissionList = (
    listRolePermissionsResponse.body?.["data"] as {
      result: Array<{ role_id: number; permission_id: number }>;
    }
  ).result;
  assert.ok(rolePermissionList.length > 0);
});

test("post create, owner update, and privileged delete all write audit logs", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Post Super Admin",
    email: "post-super-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const author = await createDirectUser({
    fullname: "Post Author",
    email: "post-author@example.com",
    password: "secret123",
    roles: ["user"],
  });

  const authorClient = new CookieClient(baseUrl);
  const superAdminClient = new CookieClient(baseUrl);

  const authorLogin = await authorClient.post("/api/auth/login", {
    body: { email: author.email, password: "secret123" },
  });
  assert.equal(authorLogin.status, 200);

  const createPostResponse = await authorClient.post("/api/posts", {
    body: { title: "My First Post", content: "Post content" },
  });
  assert.equal(createPostResponse.status, 201);
  const postId = Number(
    ((createPostResponse.body?.["data"] as { post: { id: number } })?.post.id),
  );
  assert.equal(await getAuditLogCount("create", "post", postId), 1);

  const updatePostResponse = await authorClient.put(`/api/posts/${postId}`, {
    body: { title: "My Updated Post", content: "Updated content" },
  });
  assert.equal(updatePostResponse.status, 200);
  assert.equal(await getAuditLogCount("update", "post", postId), 1);

  const superAdminLogin = await superAdminClient.post("/api/auth/login", {
    body: { email: superAdmin.email, password: "secret123" },
  });
  assert.equal(superAdminLogin.status, 200);

  const deletePostResponse = await superAdminClient.delete(`/api/posts/${postId}`);
  assert.equal(deletePostResponse.status, 200);
  assert.equal(await getAuditLogCount("delete", "post", postId), 1);
});
