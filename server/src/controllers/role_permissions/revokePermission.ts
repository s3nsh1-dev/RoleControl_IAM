import { asyncHandler } from "@/utils/asyncHandler.ts";
import { AppResponse } from "@/utils/AppResponse.ts";
import { AppError } from "@/utils/AppError.ts";
import { pool } from "@/config/db.connect.ts";
import { auditDBMutation, checkRolePermissions } from "@/utils/helper.ts";
import { parsePositiveInt } from "@/utils/validation.util.ts";
import { RolePermissionMutationRequestSchema } from "@/contracts/api.contracts.ts";
import { toRolePermissionAssignment } from "@/contracts/api.mappers.ts";

const revokePermission = asyncHandler(async (req, res) => {
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
    await checkRolePermissions(actorId, "revoke", "permission");
    await client.query("BEGIN");

    const roleExists = await client.query(
      "SELECT id, name, description FROM roles WHERE name = $1",
      [roleName],
    );
    const permissionExists = await client.query(
      "SELECT id, action, resource, description FROM permissions WHERE action = $1 AND resource = $2",
      [action, resource],
    );

    if ((roleExists.rowCount ?? 0) === 0) {
      throw AppError.notFound("Role does not exists");
    }
    if ((permissionExists.rowCount ?? 0) === 0) {
      throw AppError.notFound("Permission does not exists");
    }

    const revokedPermission = await client.query(
      `DELETE FROM role_permissions
       WHERE role_id = $1 AND permission_id = $2
       RETURNING id, role_id, permission_id`,
      [roleExists.rows[0].id, permissionExists.rows[0].id],
    );
    if ((revokedPermission.rowCount ?? 0) !== 1) {
      throw AppError.notFound(
        `${roleName} does not have permission to ${action}:${resource}`,
      );
    }

    await auditDBMutation({
      actorId,
      actionType: "revoke",
      resourceType: "permission",
      resourceId: revokedPermission.rows[0].id,
      oldValues: revokedPermission.rows[0],
      metadata: {
        message: `${actorId} performed revoke:permission on ${roleName} to remove ${action}:${resource}`,
      },
      db: client,
    });

    await client.query("COMMIT");
    new AppResponse(
      200,
      `${roleName} no longer has permission to ${action}:${resource}`,
      {
        assignment: toRolePermissionAssignment(
          revokedPermission.rows[0],
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

export { revokePermission };
