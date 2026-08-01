import assert from "node:assert/strict";
import { test } from "node:test";
import { createDirectUser, getAuditLogEntries } from "../support/database.ts";
import {
  assertErrorResponse,
  getResponseData,
  loginAsUser,
} from "./helpers.ts";

test("super-admin can create, view, list, and update users through mounted routes", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Super Admin",
    email: "super-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const client = await loginAsUser(superAdmin);

  const createUserResponse = await client.post("/api/users", {
    body: {
      fullname: "Editor User",
      email: "editor-user@example.com",
      password: "secret123",
      roleName: "editor",
    },
  });
  assert.equal(createUserResponse.status, 201);
  const createdUserId = getResponseData<{ user: { id: number } }>(
    createUserResponse,
  ).user.id;
  const createAdminResponse = await client.post("/api/users", {
    body: {
      fullname: "Created Admin User",
      email: "created-admin-user@example.com",
      password: "secret123",
      roleName: "admin",
    },
  });
  assert.equal(createAdminResponse.status, 201);
  const createdAdminId = getResponseData<{ user: { id: number } }>(
    createAdminResponse,
  ).user.id;

  const createAuditEntries = await getAuditLogEntries(
    "create",
    "user",
    createdUserId,
  );
  assert.equal(createAuditEntries.length, 1);
  assert.equal(createAuditEntries[0]?.new_values?.["email"], "editor-user@example.com");

  const viewUserResponse = await client.get(`/api/users/${createdUserId}`);
  assert.equal(viewUserResponse.status, 200);

  const listUsersResponse = await client.get("/api/users");
  assert.equal(listUsersResponse.status, 200);
  const listedUsers = getResponseData<{ users: Array<{ id: number; roleNames: string[] }> }>(
    listUsersResponse,
  ).users;
  const listedEditor = listedUsers.find((listedUser) => listedUser.id === createdUserId);
  const listedAdmin = listedUsers.find((listedUser) => listedUser.id === createdAdminId);
  assert.ok(listedEditor, "Expected the new editor to appear in the list-users response");
  assert.ok(listedAdmin, "Expected the new admin to appear in the list-users response");
  assert.deepEqual(listedEditor.roleNames.sort(), ["editor", "user"]);
  assert.deepEqual(listedAdmin.roleNames.sort(), ["admin", "user"]);

  const paginatedUsersResponse = await client.get("/api/users?page=1&pageSize=1");
  assert.equal(paginatedUsersResponse.status, 200);
  const paginatedUsers = getResponseData<{
    users: Array<{ id: number; roleNames: string[] }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>(paginatedUsersResponse);
  assert.equal(paginatedUsers.users.length, 1);
  assert.equal(paginatedUsers.pagination.page, 1);
  assert.equal(paginatedUsers.pagination.pageSize, 1);
  assert.ok(paginatedUsers.pagination.total >= 2);
  assert.ok(paginatedUsers.pagination.totalPages >= 2);
  assert.ok(
    Array.isArray(paginatedUsers.users[0]?.roleNames),
    "Expected list-users rows to expose small roleNames arrays",
  );

  const updateUserResponse = await client.put(`/api/users/${createdUserId}`, {
    body: { fullname: "Editor User Updated" },
  });
  assert.equal(updateUserResponse.status, 200);

  const updateAuditEntries = await getAuditLogEntries(
    "update",
    "user",
    createdUserId,
  );
  assert.equal(updateAuditEntries.length, 1);
  assert.equal(updateAuditEntries[0]?.old_values?.["fullname"], "Editor User");
  assert.equal(updateAuditEntries[0]?.new_values?.["fullname"], "Editor User Updated");
});

test("user creation denials and validation errors return descriptive messages", async () => {
  const admin = await createDirectUser({
    fullname: "Admin User",
    email: "admin-user@example.com",
    password: "secret123",
    roles: ["admin", "user"],
  });
  const adminClient = await loginAsUser(admin);

  const adminCreateResponse = await adminClient.post("/api/users", {
    body: {
      fullname: "Editor Candidate",
      email: "editor-candidate@example.com",
      password: "secret123",
      roleName: "editor",
    },
  });
  assertErrorResponse(adminCreateResponse, 403, /permission to create on user/i);

  const superAdmin = await createDirectUser({
    fullname: "Root Admin",
    email: "root-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const superAdminClient = await loginAsUser(superAdmin);

  const invalidCreateResponse = await superAdminClient.post("/api/users", {
    body: {
      fullname: "Ed",
      email: "not-an-email",
      password: "abc",
      roleName: "user",
    },
  });
  assertErrorResponse(
    invalidCreateResponse,
    400,
    /full name must be at least 3 characters long|invalid email|string must contain at least 4 character/i,
  );
});

test("users can change their own password only with the correct old password", async () => {
  const user = await createDirectUser({
    fullname: "Password User",
    email: "password-user@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(user);

  const missingOldPassword = await client.put(`/api/users/${user.id}`, {
    body: { newPassword: "newsecret123" },
  });
  assertErrorResponse(
    missingOldPassword,
    400,
    /old password is required to change your password/i,
  );

  const wrongOldPassword = await client.put(`/api/users/${user.id}`, {
    body: { oldPassword: "wrong-old-password", newPassword: "newsecret123" },
  });
  assertErrorResponse(wrongOldPassword, 401, /incorrect password/i);

  const successfulUpdate = await client.put(`/api/users/${user.id}`, {
    body: { oldPassword: "secret123", newPassword: "newsecret123" },
  });
  assert.equal(successfulUpdate.status, 200);

  const updateAuditEntries = await getAuditLogEntries("update", "user", user.id);
  assert.equal(updateAuditEntries.length, 1);
  assert.equal(updateAuditEntries[0]?.metadata?.["passwordChanged"], true);

  const invalidOldPasswordLogin = await client.post("/api/auth/login", {
    body: { email: user.email, password: "secret123" },
  });
  assertErrorResponse(invalidOldPasswordLogin, 401, /invalid email or password/i);

  const freshClient = await loginAsUser(user, "newsecret123");
  const freshLogout = await freshClient.post("/api/auth/logout");
  assert.equal(freshLogout.status, 200);
});

test("users cannot delete themselves", async () => {
  const admin = await createDirectUser({
    fullname: "Self Delete Admin",
    email: "self-delete-admin@example.com",
    password: "secret123",
    roles: ["admin", "user"],
  });
  const client = await loginAsUser(admin);

  const deleteResponse = await client.delete(`/api/users/${admin.id}`);
  assertErrorResponse(deleteResponse, 403, /you cannot delete yourself/i);
});

test("delete-user hierarchy is enforced for admin versus editor and super-admin targets", async () => {
  const admin = await createDirectUser({
    fullname: "Delete Admin",
    email: "delete-admin@example.com",
    password: "secret123",
    roles: ["admin", "user"],
  });
  const editor = await createDirectUser({
    fullname: "Target Editor",
    email: "target-editor@example.com",
    password: "secret123",
    roles: ["editor", "user"],
  });
  const superAdmin = await createDirectUser({
    fullname: "Protected Super Admin",
    email: "protected-super-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const client = await loginAsUser(admin);

  const deleteEditorResponse = await client.delete(`/api/users/${editor.id}`);
  assert.equal(deleteEditorResponse.status, 200);

  const deleteAuditEntries = await getAuditLogEntries("delete", "user", editor.id);
  assert.equal(deleteAuditEntries.length, 1);
  assert.equal(deleteAuditEntries[0]?.old_values?.["email"], editor.email);

  const deleteSuperAdminResponse = await client.delete(`/api/users/${superAdmin.id}`);
  assertErrorResponse(deleteSuperAdminResponse, 403, /you cannot delete this user/i);
});
