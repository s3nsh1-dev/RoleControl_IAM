import { parseEmail, parsePositiveInt } from "@/utils/validation.util.ts";
import type { ACTIONS_TYPES, RESOURCES_TYPES } from "@/types/commonTypes.ts";

type CapabilityKey =
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.delete"
  | "users.assignRole"
  | "users.revokeRole"
  | "roles.view"
  | "roles.create"
  | "roles.update"
  | "roles.delete"
  | "permissions.view"
  | "permissions.create"
  | "permissions.delete"
  | "rolePermissions.view"
  | "rolePermissions.assign"
  | "rolePermissions.revoke"
  | "posts.view"
  | "posts.create"
  | "posts.update"
  | "posts.delete"
  | "posts.createOnBehalf"
  | "auditLogs.view"
  | "migrations.view"
  | "sessions.view"
  | "sessions.revoke"
  | "sessions.delete";

type PermissionLike = {
  action: ACTIONS_TYPES;
  resource: RESOURCES_TYPES;
};

const toIsoTimestamp = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
};

const toAuthenticatedUser = (user: Record<string, unknown>) => ({
  id: parsePositiveInt(user["id"], "user.id"),
  fullname: String(user["fullname"] ?? ""),
  email: parseEmail(user["email"], "user.email"),
});

const toUserSummary = (user: Record<string, unknown>) => ({
  id: parsePositiveInt(user["id"], "user.id"),
  fullname: String(user["fullname"] ?? ""),
  email: parseEmail(user["email"], "user.email"),
  is_active: Boolean(user["is_active"]),
  created_at: toIsoTimestamp(user["created_at"]),
  created_by:
    user["created_by"] == null
      ? null
      : parsePositiveInt(user["created_by"], "user.created_by"),
});

const toUserListItem = (user: Record<string, unknown>) => {
  const roleNames = Array.isArray(user["roleNames"])
    ? user["roleNames"]
    : Array.isArray(user["role_names"])
      ? user["role_names"]
      : [];

  return {
    ...toUserSummary(user),
    roleNames: roleNames.map((roleName) => String(roleName)),
  };
};

const toRole = (role: Record<string, unknown>) => ({
  id: parsePositiveInt(role["id"], "role.id"),
  name: String(role["name"] ?? ""),
  description: role["description"] == null ? null : String(role["description"]),
});

const toPermission = (permission: Record<string, unknown>) => ({
  id: parsePositiveInt(permission["id"], "permission.id"),
  action: String(permission["action"] ?? ""),
  resource: String(permission["resource"] ?? ""),
  description:
    permission["description"] == null
      ? null
      : String(permission["description"]),
});

const toPost = (post: Record<string, unknown>) => ({
  id: parsePositiveInt(post["id"], "post.id"),
  title: String(post["title"] ?? ""),
  content: post["content"] == null ? null : String(post["content"]),
  owner_id: parsePositiveInt(post["owner_id"], "post.owner_id"),
  owner_fullname: String(post["owner_fullname"] ?? ""),
  created_at: toIsoTimestamp(post["created_at"]),
  behalf_of:
    post["behalf_of"] == null
      ? null
      : parsePositiveInt(post["behalf_of"], "post.behalf_of"),
});

const toAuditPayload = (value: unknown) => {
  if (value == null) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
};

const toAuditLog = (auditLog: Record<string, unknown>) => ({
  id: parsePositiveInt(auditLog["id"], "auditLog.id"),
  actor_id:
    auditLog["actor_id"] == null
      ? null
      : parsePositiveInt(auditLog["actor_id"], "auditLog.actor_id"),
  actor_fullname:
    auditLog["actor_fullname"] == null
      ? null
      : String(auditLog["actor_fullname"]),
  action_type: String(auditLog["action_type"] ?? ""),
  resource_type: String(auditLog["resource_type"] ?? ""),
  resource_id: parsePositiveInt(auditLog["resource_id"], "auditLog.resource_id"),
  old_values: toAuditPayload(auditLog["old_values"]),
  new_values: toAuditPayload(auditLog["new_values"]),
  metadata: toAuditPayload(auditLog["metadata"]),
  created_at: toIsoTimestamp(auditLog["created_at"]),
});

const toMigration = (migration: Record<string, unknown>) => ({
  id: parsePositiveInt(migration["id"], "migration.id"),
  name: String(migration["name"] ?? ""),
  run_on: toIsoTimestamp(migration["run_on"]),
});

const toSession = (session: Record<string, unknown>) => {
  const expiresAt = new Date(String(session["expires_at"]));
  const revokedAt = session["revoked_at"];

  return {
    id: parsePositiveInt(session["id"], "session.id"),
    user_id: parsePositiveInt(session["user_id"], "session.user_id"),
    user_fullname: String(session["user_fullname"] ?? ""),
    expires_at: expiresAt.toISOString(),
    revoked_at: revokedAt == null ? null : toIsoTimestamp(revokedAt),
    device_info:
      session["device_info"] == null ? null : String(session["device_info"]),
    is_active: revokedAt == null && expiresAt.getTime() > Date.now(),
    created_at: toIsoTimestamp(session["created_at"]),
  };
};

const toUserRoleAssignment = (
  assignment: Record<string, unknown>,
  role: Record<string, unknown>,
) => ({
  id: parsePositiveInt(assignment["id"], "assignment.id"),
  user_id: parsePositiveInt(assignment["user_id"], "assignment.user_id"),
  role: toRole(role),
});

const toRolePermissionAssignment = (
  assignment: Record<string, unknown>,
  role: Record<string, unknown>,
  permission: Record<string, unknown>,
) => ({
  id: parsePositiveInt(assignment["id"], "assignment.id"),
  role: toRole(role),
  permission: toPermission(permission),
});

const toCapabilityKeys = (permissions: PermissionLike[]): CapabilityKey[] => {
  const capabilitySet = new Set<CapabilityKey>();
  const permissionSet = new Set(
    permissions.map(
      (permission) => `${permission.action}:${permission.resource}` as const,
    ),
  );

  for (const permission of permissions) {
    const key = `${permission.action}:${permission.resource}`;

    switch (key) {
      case "view:user":
        capabilitySet.add("users.view");
        break;
      case "create:user":
        capabilitySet.add("users.create");
        break;
      case "update:user":
        capabilitySet.add("users.update");
        break;
      case "delete:user":
        capabilitySet.add("users.delete");
        break;
      case "view:role":
        capabilitySet.add("roles.view");
        break;
      case "create:role":
        capabilitySet.add("roles.create");
        break;
      case "update:role":
        capabilitySet.add("roles.update");
        break;
      case "delete:role":
        capabilitySet.add("roles.delete");
        break;
      case "assign:role":
        capabilitySet.add("users.assignRole");
        break;
      case "revoke:role":
        capabilitySet.add("users.revokeRole");
        break;
      case "view:permission":
        capabilitySet.add("permissions.view");
        break;
      case "create:permission":
        capabilitySet.add("permissions.create");
        break;
      case "delete:permission":
        capabilitySet.add("permissions.delete");
        break;
      case "assign:permission":
        capabilitySet.add("rolePermissions.assign");
        break;
      case "revoke:permission":
        capabilitySet.add("rolePermissions.revoke");
        break;
      case "view:post":
        capabilitySet.add("posts.view");
        break;
      case "create:post":
        capabilitySet.add("posts.create");
        break;
      case "update:post":
        capabilitySet.add("posts.update");
        break;
      case "delete:post":
        capabilitySet.add("posts.delete");
        break;
      case "createOnBehalf:post":
        capabilitySet.add("posts.createOnBehalf");
        break;
      case "view:audit_log":
        capabilitySet.add("auditLogs.view");
        break;
      case "view:migration":
        capabilitySet.add("migrations.view");
        break;
      case "view:session":
        capabilitySet.add("sessions.view");
        break;
      case "revoke:session":
        capabilitySet.add("sessions.revoke");
        break;
      case "delete:session":
        capabilitySet.add("sessions.delete");
        break;
      default:
        break;
    }
  }

  if (permissionSet.has("view:role") && permissionSet.has("view:permission")) {
    capabilitySet.add("rolePermissions.view");
  }

  return [...capabilitySet].sort();
};

export {
  toAuthenticatedUser,
  toUserSummary,
  toUserListItem,
  toRole,
  toPermission,
  toPost,
  toAuditLog,
  toMigration,
  toSession,
  toUserRoleAssignment,
  toRolePermissionAssignment,
  toCapabilityKeys,
};
