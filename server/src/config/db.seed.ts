import { pathToFileURL } from "node:url";
import { pool } from "./db.connect.ts";
import { PERMISSION_HIERARCHY } from "./hierarchy.ts";
import { ROLES_LIST } from "../others/constants.ts";
import type {
  ACTIONS_TYPES,
  RESOURCES_TYPES,
  ROLES_TYPES,
} from "../types/commonTypes.ts";

const roleDescriptions: Record<ROLES_TYPES, string> = {
  "super-admin": "Full system access",
  admin: "Administrative access",
  editor: "Content editor access",
  user: "Default user access",
};

const seedReferenceRbac = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleIds = new Map<ROLES_TYPES, number>();
    for (const roleName of ROLES_LIST) {
      const insertedRole = await client.query<{ id: number }>(
        `INSERT INTO roles (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name)
         DO UPDATE SET description = EXCLUDED.description
         RETURNING id`,
        [roleName, roleDescriptions[roleName]],
      );
      roleIds.set(roleName, insertedRole.rows[0]!.id);
    }

    const uniquePermissions = new Map<
      string,
      { action: ACTIONS_TYPES; resource: RESOURCES_TYPES }
    >();
    for (const permissionList of PERMISSION_HIERARCHY.values()) {
      for (const permission of permissionList) {
        const key = `${permission.action}:${permission.resource}`;
        uniquePermissions.set(key, {
          action: permission.action,
          resource: permission.resource,
        });
      }
    }

    const permissionIds = new Map<string, number>();
    for (const [key, permission] of uniquePermissions) {
      const insertedPermission = await client.query<{ id: number }>(
        `INSERT INTO permissions (action, resource, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (action, resource)
         DO UPDATE SET description = EXCLUDED.description
         RETURNING id`,
        [
          permission.action,
          permission.resource,
          `${permission.action}:${permission.resource}`,
        ],
      );
      permissionIds.set(key, insertedPermission.rows[0]!.id);
    }

    for (const [roleName, permissionList] of PERMISSION_HIERARCHY.entries()) {
      const roleId = roleIds.get(roleName);
      if (!roleId) {
        throw new Error(`Missing seeded role id for ${roleName}`);
      }

      for (const permission of permissionList) {
        const permissionId = permissionIds.get(
          `${permission.action}:${permission.resource}`,
        );
        if (!permissionId) {
          throw new Error(
            `Missing seeded permission id for ${permission.action}:${permission.resource}`,
          );
        }

        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleId, permissionId],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const entryPoint = process.argv[1];
const isDirectExecution =
  typeof entryPoint === "string" &&
  import.meta.url === pathToFileURL(entryPoint).href;

if (isDirectExecution) {
  void seedReferenceRbac()
    .then(() => {
      console.log("Reference RBAC data seeded successfully");
    })
    .catch((error) => {
      console.error("Failed to seed reference RBAC data", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

export { seedReferenceRbac };
