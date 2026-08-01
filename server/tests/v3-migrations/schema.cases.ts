import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASELINE_MIGRATION_NAME,
  runMigrations,
} from "../../src/config/db.migrate.ts";
import { PERMISSION_HIERARCHY } from "../../src/config/hierarchy.ts";
import { ROLES_LIST } from "../../src/others/constants.ts";
import { seedReferenceRbac } from "../../src/config/db.seed.ts";
import {
  getAppliedMigrationNames,
  getManagedIndexNames,
  getManagedTableNames,
  getReferenceRbacCounts,
} from "../support/database.ts";

const expectedTables = [
  "audit_logs",
  "permissions",
  "posts",
  "role_permissions",
  "roles",
  "user_roles",
  "user_sessions",
  "users",
];

const expectedIndexes = [
  "idx_audit_logs_actor_id",
  "idx_audit_logs_resource_lookup",
  "idx_posts_behalf_of",
  "idx_posts_owner_id",
  "idx_role_permissions_permission_id",
  "idx_user_roles_role_id",
  "idx_user_sessions_expires_at",
  "idx_user_sessions_user_id",
  "idx_users_created_by",
];

const expectedPermissionCount = new Set(
  [...PERMISSION_HIERARCHY.values()].flatMap((permissionList) =>
    permissionList.map(
      (permission) => `${permission.action}:${permission.resource}`,
    ),
  ),
).size;

const expectedRolePermissionCount = [...PERMISSION_HIERARCHY.values()].reduce(
  (total, permissionList) => total + permissionList.length,
  0,
);

test("baseline migration creates the full managed schema from an empty database", async () => {
  assert.deepEqual(await getAppliedMigrationNames(), [BASELINE_MIGRATION_NAME]);
  assert.deepEqual(await getManagedTableNames(), expectedTables);
  assert.deepEqual(await getManagedIndexNames(), expectedIndexes);
});

test("reference RBAC seed stays idempotent on top of the migrated schema", async () => {
  const before = await getReferenceRbacCounts();
  await seedReferenceRbac();
  const after = await getReferenceRbacCounts();

  assert.deepEqual(after, before);
  assert.equal(after.roles_count, ROLES_LIST.length);
  assert.equal(after.permissions_count, expectedPermissionCount);
  assert.equal(after.role_permissions_count, expectedRolePermissionCount);
});

test("rerunning migrate up is a no-op once the baseline has already been applied", async () => {
  const rerun = await runMigrations("up");
  assert.equal(rerun.length, 0);
  assert.deepEqual(await getAppliedMigrationNames(), [BASELINE_MIGRATION_NAME]);
});
