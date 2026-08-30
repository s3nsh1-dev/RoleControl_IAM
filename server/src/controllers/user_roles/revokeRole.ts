import { asyncHandler } from "@/utils/asyncHandler.ts";
import { AppResponse } from "@/utils/AppResponse.ts";
import { AppError } from "@/utils/AppError.ts";
import { pool } from "@/config/db.connect.ts";
import {
  auditDBMutation,
  canActorManageRole,
  checkRolePermissions,
  getHighestUserRole,
} from "@/utils/helper.ts";
import { parsePositiveInt } from "@/utils/validation.util.ts";
import { UserRoleMutationRequestSchema } from "@/contracts/api.contracts.ts";
import { toUserRoleAssignment } from "@/contracts/api.mappers.ts";

const revokeRole = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("UNAUTHORIZED REQUEST: USER NOT FOUND");
  }

  const actorId = parsePositiveInt(req.user.uId, "Actor Id");
  const userId = parsePositiveInt(req.params["userId"], "userId");
  const { roleName } = UserRoleMutationRequestSchema.parse(req.body);
  if (actorId === userId) {
    throw AppError.forbidden("You cannot revoke roles from yourself");
  }

  const client = await pool.connect();
  try {
    await checkRolePermissions(actorId, "revoke", "role");
    await client.query("BEGIN");

    const actorHighestRole = await getHighestUserRole(actorId, client);
    const targetUserExists = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [userId],
    );
    const targetRoleExists = await client.query(
      "SELECT id, name, description FROM roles WHERE name = $1",
      [roleName],
    );
    const targetHighestRole = await getHighestUserRole(userId, client);

    if (!actorHighestRole) {
      throw AppError.forbidden("Actor does not have an assigned role");
    }
    if ((targetUserExists.rowCount ?? 0) !== 1) {
      throw AppError.notFound("Target user not found");
    }
    if ((targetRoleExists.rowCount ?? 0) !== 1) {
      throw AppError.notFound("Role not found");
    }
    if (!canActorManageRole(actorHighestRole, roleName)) {
      throw AppError.forbidden("You cannot revoke this role");
    }
    if (
      targetHighestRole &&
      !canActorManageRole(actorHighestRole, targetHighestRole)
    ) {
      throw AppError.forbidden("You cannot modify roles for this user");
    }

    const revokedRole = await client.query(
      `DELETE FROM user_roles
       WHERE user_id = $1 AND role_id = $2
       RETURNING id, user_id, role_id`,
      [userId, targetRoleExists.rows[0].id],
    );
    if ((revokedRole.rowCount ?? 0) !== 1) {
      throw AppError.notFound(`${roleName} is not assigned to this user`);
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "revoke",
      resourceType: "role",
      resourceId: revokedRole.rows[0].id,
      oldValues: revokedRole.rows[0],
      metadata: {
        message: `${actorId} revoked role ${roleName} from user ${userId}`,
      },
    });

    await client.query("COMMIT");

    new AppResponse(200, "Role revoked successfully", {
      assignment: toUserRoleAssignment(
        revokedRole.rows[0],
        targetRoleExists.rows[0],
      ),
    }).send(res);
    return;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { revokeRole };
