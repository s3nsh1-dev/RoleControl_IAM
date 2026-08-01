import assert from "node:assert/strict";
import { test } from "node:test";
import { createDirectUser, getAuditLogEntries } from "../support/database.ts";
import {
  assertErrorResponse,
  getResponseData,
  loginAsUser,
} from "./helpers.ts";

test("role create, list, update, and delete flows write meaningful audit entries", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Role Super Admin",
    email: "role-super-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const client = await loginAsUser(superAdmin);

  const deleteRoleResponse = await client.delete("/api/roles/editor");
  assert.equal(deleteRoleResponse.status, 200);
  const deletedRole = getResponseData<{ role: { id: number; name: string } }>(
    deleteRoleResponse,
  ).role;

  const deleteEntries = await getAuditLogEntries("delete", "role", deletedRole.id);
  assert.equal(deleteEntries.length, 1);
  assert.equal(deleteEntries[0]?.old_values?.["name"], "editor");

  const createRoleResponse = await client.post("/api/roles", {
    body: { name: "editor", description: "Re-created editor role" },
  });
  assert.equal(createRoleResponse.status, 201);
  const createdRole = getResponseData<{
    role: { id: number; name: string; description: string | null };
  }>(createRoleResponse).role;

  const createEntries = await getAuditLogEntries("create", "role", createdRole.id);
  assert.equal(createEntries.length, 1);
  assert.equal(createEntries[0]?.new_values?.["description"], "Re-created editor role");

  const updateRoleResponse = await client.put("/api/roles/editor", {
    body: { description: "Updated editor description" },
  });
  assert.equal(updateRoleResponse.status, 200);

  const updateEntries = await getAuditLogEntries("update", "role", createdRole.id);
  assert.equal(updateEntries.length, 1);
  assert.equal(updateEntries[0]?.old_values?.["description"], "Re-created editor role");
  assert.equal(updateEntries[0]?.new_values?.["description"], "Updated editor description");

  const listRolesResponse = await client.get("/api/roles");
  assert.equal(listRolesResponse.status, 200);
});

test("assigning and revoking roles writes audit metadata and prevents self-role changes", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Assign Role Admin",
    email: "assign-role-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const targetUser = await createDirectUser({
    fullname: "Target User",
    email: "target-user@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(superAdmin);

  const assignResponse = await client.post(`/api/user-roles/${targetUser.id}`, {
    body: { roleName: "editor" },
  });
  assert.equal(assignResponse.status, 201);
  const assignedRole = getResponseData<{
    assignment: { id: number };
  }>(assignResponse).assignment;

  const assignEntries = await getAuditLogEntries("assign", "role", assignedRole.id);
  assert.equal(assignEntries.length, 1);
  assert.match(
    String(assignEntries[0]?.metadata?.["message"]),
    /assigned role editor to user/i,
  );

  const revokeResponse = await client.delete(`/api/user-roles/${targetUser.id}`, {
    body: { roleName: "editor" },
  });
  assert.equal(revokeResponse.status, 200);
  const revokedRole = getResponseData<{
    assignment: { id: number };
  }>(revokeResponse).assignment;

  const revokeEntries = await getAuditLogEntries("revoke", "role", revokedRole.id);
  assert.equal(revokeEntries.length, 1);
  assert.match(
    String(revokeEntries[0]?.metadata?.["message"]),
    /revoked role editor from user/i,
  );

  const selfAssignResponse = await client.post(`/api/user-roles/${superAdmin.id}`, {
    body: { roleName: "admin" },
  });
  assertErrorResponse(selfAssignResponse, 403, /assign roles to yourself/i);

  const selfRevokeResponse = await client.delete(`/api/user-roles/${superAdmin.id}`, {
    body: { roleName: "user" },
  });
  assertErrorResponse(selfRevokeResponse, 403, /revoke roles from yourself/i);
});

test("duplicate role assignment returns a descriptive conflict response", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Duplicate Role Admin",
    email: "duplicate-role-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const targetUser = await createDirectUser({
    fullname: "Duplicate Role Target",
    email: "duplicate-role-target@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(superAdmin);

  const duplicateAssignResponse = await client.post(`/api/user-roles/${targetUser.id}`, {
    body: { roleName: "user" },
  });
  assertErrorResponse(duplicateAssignResponse, 409, /record already exists/i);
});

test("permission create, list, duplicate, and delete flows behave correctly", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Permission Admin",
    email: "permission-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const client = await loginAsUser(superAdmin);

  const createPermissionResponse = await client.post("/api/permissions", {
    body: {
      action: "createOnBehalf",
      resource: "role",
      description: "Allow creating roles on behalf of another actor",
    },
  });
  assert.equal(createPermissionResponse.status, 201);
  const createdPermission = getResponseData<{
    permission: { id: number };
  }>(createPermissionResponse).permission;

  const createEntries = await getAuditLogEntries(
    "create",
    "permission",
    createdPermission.id,
  );
  assert.equal(createEntries.length, 1);
  assert.equal(createEntries[0]?.new_values?.["resource"], "role");

  const listPermissionsResponse = await client.get("/api/permissions");
  assert.equal(listPermissionsResponse.status, 200);
  const listedPermissions = getResponseData<{
    permissions: Array<{ id: number }>;
  }>(listPermissionsResponse).permissions;
  assert.ok(
    listedPermissions.some((permission) => permission.id === createdPermission.id),
    "Expected the created permission to be listed",
  );

  const duplicateCreateResponse = await client.post("/api/permissions", {
    body: {
      action: "createOnBehalf",
      resource: "role",
      description: "Duplicate permission",
    },
  });
  assertErrorResponse(duplicateCreateResponse, 409, /record already exists/i);

  const deletePermissionResponse = await client.delete(
    `/api/permissions/${createdPermission.id}`,
  );
  assert.equal(deletePermissionResponse.status, 200);

  const deleteEntries = await getAuditLogEntries(
    "delete",
    "permission",
    createdPermission.id,
  );
  assert.equal(deleteEntries.length, 1);
  assert.equal(deleteEntries[0]?.old_values?.["id"], createdPermission.id);
});

test("role-permission assign, list, and revoke flows write audit metadata", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Role Permission Admin",
    email: "role-permission-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const client = await loginAsUser(superAdmin);

  const assignPermissionResponse = await client.post("/api/role-permissions", {
    body: { roleName: "user", action: "update", resource: "post" },
  });
  assert.equal(assignPermissionResponse.status, 201);
  const assignedPermission = getResponseData<{
    assignment: {
      id: number;
      role: { id: number };
      permission: { id: number };
    };
  }>(assignPermissionResponse).assignment;

  const assignEntries = await getAuditLogEntries(
    "assign",
    "permission",
    assignedPermission.id,
  );
  assert.equal(assignEntries.length, 1);
  assert.match(
    String(assignEntries[0]?.metadata?.["message"]),
    /assign:permission/i,
  );

  const listRolePermissionsResponse = await client.get("/api/role-permissions");
  assert.equal(listRolePermissionsResponse.status, 200);
  const rolePermissionRows = getResponseData<{
    assignments: Array<{
      role: { id: number };
      permission: { id: number };
    }>;
  }>(listRolePermissionsResponse).assignments;
  assert.ok(
    rolePermissionRows.some(
      (row) =>
        row.role.id === assignedPermission.role.id &&
        row.permission.id === assignedPermission.permission.id,
    ),
    "Expected the new role-permission mapping to be listed",
  );

  const revokePermissionResponse = await client.delete("/api/role-permissions", {
    body: { roleName: "user", action: "update", resource: "post" },
  });
  assert.equal(revokePermissionResponse.status, 200);
  const revokedPermission = getResponseData<{
    assignment: { id: number };
  }>(revokePermissionResponse).assignment;

  const revokeEntries = await getAuditLogEntries(
    "revoke",
    "permission",
    revokedPermission.id,
  );
  assert.equal(revokeEntries.length, 1);
  assert.match(
    String(revokeEntries[0]?.metadata?.["message"]),
    /revoke:permission/i,
  );
});
