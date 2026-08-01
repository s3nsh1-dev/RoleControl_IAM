import type {
  ROLES_TYPES,
  ACTIONS_TYPES,
  RESOURCES_TYPES,
} from "../types/commonTypes.ts";

type PermissionType = {
  id: number;
  action: ACTIONS_TYPES;
  resource: RESOURCES_TYPES;
};

const ROLE_RANKS: Record<ROLES_TYPES, number> = {
  user: 1,
  editor: 2,
  admin: 3,
  "super-admin": 4,
};

const userPermissions: PermissionType[] = [
  { id: 0, action: "view", resource: "permission" },
  { id: 1, action: "view", resource: "role" },
  { id: 2, action: "view", resource: "user" },
  { id: 3, action: "view", resource: "post" },
  { id: 4, action: "create", resource: "post" },
  { id: 20, action: "view", resource: "audit_log" },
  { id: 21, action: "view", resource: "session" },
  { id: 22, action: "view", resource: "migration" },
];

const editorPermissions: PermissionType[] = [
  ...userPermissions,
  { id: 5, action: "update", resource: "user" },
  { id: 6, action: "update", resource: "post" },
  { id: 7, action: "update", resource: "role" },
];

const adminPermissions: PermissionType[] = [
  ...userPermissions,
  { id: 5, action: "assign", resource: "role" },
  { id: 6, action: "revoke", resource: "role" },
  { id: 7, action: "delete", resource: "user" },
  { id: 8, action: "delete", resource: "post" },
  { id: 23, action: "revoke", resource: "session" },
];

const superAdminPermissions: PermissionType[] = [
  ...userPermissions,
  { id: 5, action: "create", resource: "permission" },
  { id: 6, action: "delete", resource: "permission" },
  { id: 7, action: "revoke", resource: "permission" },
  { id: 8, action: "assign", resource: "permission" },
  { id: 9, action: "create", resource: "role" },
  { id: 10, action: "assign", resource: "role" },
  { id: 11, action: "delete", resource: "role" },
  { id: 12, action: "revoke", resource: "role" },
  { id: 13, action: "create", resource: "user" },
  { id: 14, action: "delete", resource: "user" },
  { id: 15, action: "update", resource: "user" },
  { id: 16, action: "delete", resource: "post" },
  { id: 17, action: "update", resource: "post" },
  { id: 18, action: "createOnBehalf", resource: "post" },
  { id: 19, action: "update", resource: "role" },
  // this permission is asked when revoking single sessions of a user
  { id: 23, action: "revoke", resource: "session" },
  // this permission is asked when revoking all sessions of a single user
  { id: 24, action: "delete", resource: "session" },
];

const PERMISSION_HIERARCHY = new Map<ROLES_TYPES, PermissionType[]>();
PERMISSION_HIERARCHY.set("user", userPermissions);
PERMISSION_HIERARCHY.set("editor", editorPermissions);
PERMISSION_HIERARCHY.set("admin", adminPermissions);
PERMISSION_HIERARCHY.set("super-admin", superAdminPermissions);

export { PERMISSION_HIERARCHY, ROLE_RANKS };
