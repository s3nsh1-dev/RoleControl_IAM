/**
 * assign and permission  + add audit log for that permission
 *
 * 1. take the actorId from req.user.uId
 * 2. check the actor is able to "assign" "permission" or not ?
 * 3. take the rName, and what action and resource does this role going to have permission for ?
 * 4. if permission and condition is passed then open a transaction
 * 5. insert into the role_permissions and save snapshot in audit_logs
 * 6. send the response
 */

import { asyncHandler } from "@/utils/asyncHandler.ts";
import { AppResponse } from "@/utils/AppResponse.ts";
import { AppError } from "@/utils/AppError.ts";
import { parsePositiveInt } from "@/utils/validation.util.ts";
import { pool } from "@/config/db.connect.ts";
import { checkRolePermissions } from "@/utils/helper.ts";
import { auditDBMutation } from "@/utils/helper.ts";
import { RolePermissionMutationRequestSchema } from "@/contracts/api.contracts.ts";
import { toRolePermissionAssignment } from "@/contracts/api.mappers.ts";

const assignPermission = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("UNAUTHORIZED REQUEST: USER NOT FOUND");
  }
  const actorId = parsePositiveInt(req.user.uId, "Actor Id");
  const {
    roleName,
    action,
    resource,
  } = RolePermissionMutationRequestSchema.parse(req.body);

  const client = await pool.connect();
  try {
    await checkRolePermissions(actorId, "assign", "permission");
    await client.query("BEGIN");

    const roleExists = await client.query(
      "SELECT id, name, description FROM roles WHERE name = $1",
      [roleName],
    );
    const permissionExists = await client.query(
      "SELECT id, action, resource, description FROM permissions WHERE action = $1 AND resource = $2",
      [action, resource],
    );

    if (roleExists.rowCount == 0)
      throw AppError.notFound(`Role does not exists`);
    if (permissionExists.rowCount === 0)
      throw AppError.notFound("Permission does not exists");

    const permissionAssignment = await client.query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) RETURNING id, role_id, permission_id`,
      [roleExists.rows[0].id, permissionExists.rows[0].id],
    );
    if ((permissionAssignment.rowCount ?? 0) !== 1) {
      throw AppError.badRequest("Failed to assign permission to role");
    }
    await auditDBMutation({
      actorId,
      actionType: "assign",
      resourceType: "permission",
      resourceId: permissionAssignment.rows[0].id,
      newValues: permissionAssignment.rows[0],
      metadata: {
        message: `${actorId} performed assign:permission on ${roleName} to have ${action}:${resource}`,
      },
      db: client,
    });
    await client.query("COMMIT");
    new AppResponse(
      201,
      `Now ${roleName} has permission to ${action}:${resource}`,
      {
        assignment: toRolePermissionAssignment(
          permissionAssignment.rows[0],
          roleExists.rows[0],
          permissionExists.rows[0],
        ),
      },
    ).send(res);
    return;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { assignPermission };
