import assert from "node:assert/strict";
import { test } from "node:test";
import { openApiDocument } from "../../src/openapi/document.ts";

test("openapi document exposes the documented routes and security schemes", () => {
  assert.equal(openApiDocument.openapi, "3.1.0");
  const paths = openApiDocument.paths ?? {};

  assert.ok(paths["/api/auth/login"]);
  assert.ok(paths["/api/auth/me"]);
  assert.ok(paths["/api/users"]);
  assert.ok(paths["/api/roles/{roleName}"]);
  assert.ok(paths["/api/permissions/{permissionId}"]);
  assert.ok(paths["/api/user-roles/{userId}"]);
  assert.ok(paths["/api/role-permissions"]);
  assert.ok(paths["/api/posts/{postId}"]);
  assert.ok(paths["/api/audit-logs"]);
  assert.ok(paths["/api/system/migrations"]);
  assert.ok(paths["/api/sessions"]);
  assert.ok(paths["/api/users/{userId}/sessions"]);
  assert.ok(paths["/api/sessions/{sessionId}/revoke"]);
  assert.ok(paths["/api/users/{userId}/sessions/revoke-all"]);

  const securitySchemes =
    openApiDocument.components?.securitySchemes ?? {};

  assert.ok(securitySchemes["accessCookieAuth"]);
  assert.ok(securitySchemes["refreshCookieAuth"]);

  const schemas = openApiDocument.components?.schemas ?? {};
  assert.ok(schemas["AuthMeResponse"]);
  assert.ok(schemas["CapabilityKey"]);
  assert.ok(schemas["PaginationMeta"]);
  assert.ok(schemas["UserListItem"]);
  assert.ok(schemas["AuditLog"]);
  assert.ok(schemas["Migration"]);
  assert.ok(schemas["Session"]);
  assert.ok(schemas["ListAuditLogsResponse"]);
  assert.ok(schemas["ListMigrationsResponse"]);
  assert.ok(schemas["ListSessionsResponse"]);
  assert.ok(schemas["SessionRevokeResponse"]);
  assert.ok(schemas["SessionRevokeAllResponse"]);
});
