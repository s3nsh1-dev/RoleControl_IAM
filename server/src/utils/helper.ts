import type {
  ROLES_TYPES,
  ACTIONS_TYPES,
  RESOURCES_TYPES,
  AuditDBMutationInput,
  QueryableDb,
} from "../types/commonTypes.ts";
import { ROLE_RANKS } from "../config/hierarchy.ts";
import { pool } from "../config/db.connect.ts";
import { AppError } from "./AppError.ts";
import { parseEmail, parsePositiveInt } from "./validation.util.ts";

function sortRoleBasedOnRanks(list: ROLES_TYPES[]): ROLES_TYPES[] {
  return [...list].sort((a, b) => ROLE_RANKS[b] - ROLE_RANKS[a]);
}

function isKnownRoleName(roleName: string): roleName is ROLES_TYPES {
  return roleName in ROLE_RANKS;
}

function canActorManageRole(
  actorHighestRole: ROLES_TYPES,
  targetRoleName: string,
): boolean {
  if (!isKnownRoleName(targetRoleName)) {
    return actorHighestRole === "super-admin";
  }

  if (actorHighestRole === "super-admin") {
    return true;
  }

  if (actorHighestRole === "admin") {
    return targetRoleName === "editor" || targetRoleName === "user";
  }

  return false;
}

async function checkRolePermissions(
  actorId: number,
  action: ACTIONS_TYPES,
  resource: RESOURCES_TYPES,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
       AND p.action = $2
       AND p.resource = $3
     LIMIT 1`,
    [actorId, action, resource],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw AppError.forbidden(
      `You do not have permission to ${action} on ${resource}`,
    );
  }

  return true;
}

async function getUserRoleNames(
  userId: number,
  db: QueryableDb = pool,
): Promise<ROLES_TYPES[]> {
  const roleResult = await db.query<{ name: string }>(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );

  return roleResult.rows
    .map((row) => row.name)
    .filter((roleName): roleName is ROLES_TYPES => isKnownRoleName(roleName));
}

async function getUserEffectivePermissions(
  userId: number,
  db: QueryableDb = pool,
): Promise<Array<{ action: ACTIONS_TYPES; resource: RESOURCES_TYPES }>> {
  const permissionResult = await db.query<{
    action: ACTIONS_TYPES;
    resource: RESOURCES_TYPES;
  }>(
    `SELECT DISTINCT p.action, p.resource
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
     ORDER BY p.resource ASC, p.action ASC`,
    [userId],
  );

  return permissionResult.rows;
}

async function getHighestUserRole(
  userId: number,
  db: QueryableDb = pool,
): Promise<ROLES_TYPES | null> {
  const roleNames = await getUserRoleNames(userId, db);
  return sortRoleBasedOnRanks(roleNames)[0] ?? null;
}

const createUserPayload = <T extends object>(
  user: any,
  type: "access" | "refresh",
): T => {
  if (type === "refresh") {
    return {
      uId: parsePositiveInt(user.id, "user.id"),
      sId: parsePositiveInt(user.sessionId, "user_session.id"),
      type: "refresh",
    } as T;
  }
  return {
    uId: parsePositiveInt(user.id, "user.id"),
    email: parseEmail(user.email, "user.email"),
  } as T;
};

function sanitizeUserRecord<T extends Record<string, unknown>>(user: T) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

const auditDBMutation = async ({
  actorId,
  actionType,
  resourceType,
  resourceId,
  oldValues = null,
  newValues = null,
  metadata = null,
  db = pool,
}: AuditDBMutationInput) => {
  const auditLogResult = await db.query<{ id: number }>(
    `INSERT INTO audit_logs (
      actor_id,
      action_type,
      resource_type,
      resource_id,
      old_values,
      new_values,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      actorId,
      actionType,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      metadata,
    ],
  );

  if ((auditLogResult.rowCount ?? 0) !== 1) {
    throw AppError.internal("Failed to create audit log entry");
  }

  return auditLogResult.rows[0];
};

export {
  sortRoleBasedOnRanks,
  isKnownRoleName,
  canActorManageRole,
  checkRolePermissions,
  getUserRoleNames,
  getUserEffectivePermissions,
  getHighestUserRole,
  createUserPayload,
  sanitizeUserRecord,
  auditDBMutation,
};
