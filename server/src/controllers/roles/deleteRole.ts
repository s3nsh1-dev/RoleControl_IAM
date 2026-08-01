import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import {
  auditDBMutation,
  canActorManageRole,
  checkRolePermissions,
  getHighestUserRole,
} from "../../utils/helper.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { toRole } from "@/contracts/api.mappers.ts";

const deleteRole = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "delete", "role");

  const roleNameParam = req.params["roleName"];
  if (!roleNameParam) {
    throw AppError.badRequest("Role name is required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingRoleResult = await client.query(
      `SELECT id, name, description
       FROM roles
       WHERE name = $1
       FOR UPDATE`,
      [roleNameParam],
    );
    const existingRole = existingRoleResult.rows[0];
    if (!existingRole) {
      throw AppError.notFound("Role not found");
    }

    const actorHighestRole = await getHighestUserRole(actorId, client);
    if (!actorHighestRole) {
      throw AppError.forbidden("Actor does not have an assigned role");
    }
    if (!canActorManageRole(actorHighestRole, existingRole.name)) {
      throw AppError.forbidden("You cannot delete this role");
    }

    const deletedRoleResult = await client.query(
      `DELETE FROM roles
       WHERE id = $1
       RETURNING id, name, description`,
      [existingRole.id],
    );
    if ((deletedRoleResult.rowCount ?? 0) !== 1) {
      throw AppError.notFound("Role not found");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "delete",
      resourceType: "role",
      resourceId: deletedRoleResult.rows[0].id,
      oldValues: existingRole,
      newValues: null,
    });

    await client.query("COMMIT");

    new AppResponse(200, "Role deleted successfully", {
      role: toRole(deletedRoleResult.rows[0]),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { deleteRole };
