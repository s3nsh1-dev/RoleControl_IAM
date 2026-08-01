import { pool } from "../../src/config/db.connect.ts";
import { runMigrations, MIGRATIONS_TABLE } from "../../src/config/db.migrate.ts";
import { seedReferenceRbac } from "../../src/config/db.seed.ts";
import { prepareDatabase } from "../../src/config/db.setup.ts";
import { generateHashString } from "../../src/utils/encryptStrings.ts";
import type { ACTIONS_TYPES, RESOURCES_TYPES, ROLES_TYPES } from "../../src/types/commonTypes.ts";

type DirectUserInput = {
  fullname: string;
  email: string;
  password: string;
  roles: ROLES_TYPES[];
  createdBy?: number | null;
};

type AuditLogEntry = {
  id: number;
  actor_id: number | null;
  action_type: ACTIONS_TYPES;
  resource_type: RESOURCES_TYPES;
  resource_id: number;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

const managedSchemaTables = [
  "users",
  "roles",
  "permissions",
  "user_roles",
  "role_permissions",
  "posts",
  "user_sessions",
  "audit_logs",
] as const;

const managedIndexes = [
  "idx_users_created_by",
  "idx_user_roles_role_id",
  "idx_role_permissions_permission_id",
  "idx_posts_owner_id",
  "idx_posts_behalf_of",
  "idx_user_sessions_user_id",
  "idx_user_sessions_expires_at",
  "idx_audit_logs_actor_id",
  "idx_audit_logs_resource_lookup",
] as const;

const resetDatabase = async () => {
  await prepareDatabase();
};

const clearMigrationManagedState = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DROP TABLE IF EXISTS ${MIGRATIONS_TABLE}, audit_logs, user_sessions, posts, role_permissions, user_roles, permissions, roles, users CASCADE;`,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const resetDatabaseWithMigrations = async () => {
  await clearMigrationManagedState();
  await runMigrations("up");
};

const createDirectUser = async ({
  fullname,
  email,
  password,
  roles,
  createdBy = null,
}: DirectUserInput) => {
  const hashedPassword = await generateHashString(password);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertedUser = await client.query<{
      id: number;
      fullname: string;
      email: string;
      is_active: boolean;
      created_by: number | null;
    }>(
      `INSERT INTO users (fullname, email, password, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, fullname, email, is_active, created_by`,
      [fullname, email, hashedPassword, true, createdBy],
    );

    const user = insertedUser.rows[0]!;
    for (const roleName of roles) {
      const roleQuery = await client.query<{ id: number }>(
        "SELECT id FROM roles WHERE name = $1",
        [roleName],
      );
      const roleId = roleQuery.rows[0]?.id;
      if (!roleId) {
        throw new Error(`Role ${roleName} not found while creating test user`);
      }

      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [user.id, roleId],
      );
    }

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getUserSessions = async (userId: number) => {
  const result = await pool.query<{
    id: number;
    refresh_token_hash: string;
    revoked_at: Date | null;
    expires_at: Date;
    created_at: Date;
  }>(
    `SELECT id, refresh_token_hash, revoked_at, expires_at, created_at
     FROM user_sessions
     WHERE user_id = $1
     ORDER BY created_at ASC, id ASC`,
    [userId],
  );

  return result.rows;
};

const getAppliedMigrationNames = async () => {
  const tableExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [MIGRATIONS_TABLE],
  );

  if (!tableExists.rows[0]?.exists) {
    return [] as string[];
  }

  const result = await pool.query<{ name: string }>(
    `SELECT name
     FROM ${MIGRATIONS_TABLE}
     ORDER BY id ASC`,
  );

  return result.rows.map((row) => row.name);
};

const getManagedTableNames = async () => {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
     ORDER BY table_name ASC`,
    [managedSchemaTables],
  );

  return result.rows.map((row) => row.table_name);
};

const getManagedIndexNames = async () => {
  const result = await pool.query<{ indexname: string }>(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = ANY($1::text[])
     ORDER BY indexname ASC`,
    [managedIndexes],
  );

  return result.rows.map((row) => row.indexname);
};

const getReferenceRbacCounts = async () => {
  const result = await pool.query<{
    roles_count: number;
    permissions_count: number;
    role_permissions_count: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM roles) AS roles_count,
       (SELECT COUNT(*)::int FROM permissions) AS permissions_count,
       (SELECT COUNT(*)::int FROM role_permissions) AS role_permissions_count`,
  );

  return result.rows[0]!;
};

const getAuditLogCount = async (
  actionType: ACTIONS_TYPES,
  resourceType: RESOURCES_TYPES,
  resourceId: number,
) => {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM audit_logs
     WHERE action_type = $1 AND resource_type = $2 AND resource_id = $3`,
    [actionType, resourceType, resourceId],
  );

  return result.rows[0]?.count ?? 0;
};

const getAuditLogEntries = async (
  actionType: ACTIONS_TYPES,
  resourceType: RESOURCES_TYPES,
  resourceId: number,
) => {
  const result = await pool.query<AuditLogEntry>(
    `SELECT id, actor_id, action_type, resource_type, resource_id, old_values, new_values, metadata, created_at
     FROM audit_logs
     WHERE action_type = $1 AND resource_type = $2 AND resource_id = $3
     ORDER BY created_at DESC, id DESC`,
    [actionType, resourceType, resourceId],
  );

  return result.rows;
};

const expireSessionDirectly = async (sessionId: number) => {
  const result = await pool.query(
    `UPDATE user_sessions
     SET expires_at = NOW() - INTERVAL '1 minute'
     WHERE id = $1
     RETURNING id`,
    [sessionId],
  );

  return (result.rowCount ?? 0) === 1;
};

const revokeSessionDirectly = async (sessionId: number) => {
  const result = await pool.query(
    `UPDATE user_sessions
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE id = $1
     RETURNING id`,
    [sessionId],
  );

  return (result.rowCount ?? 0) === 1;
};

export {
  resetDatabase,
  resetDatabaseWithMigrations,
  seedReferenceRbac,
  createDirectUser,
  getUserSessions,
  getAppliedMigrationNames,
  getManagedTableNames,
  getManagedIndexNames,
  getReferenceRbacCounts,
  getAuditLogCount,
  getAuditLogEntries,
  expireSessionDirectly,
  revokeSessionDirectly,
};
