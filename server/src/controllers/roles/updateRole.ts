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
import { UpdateRoleRequestSchema } from "@/contracts/api.contracts.ts";
import { toRole } from "@/contracts/api.mappers.ts";

const updateRole = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "update", "role");

  const roleNameParam = req.params["roleName"];
  if (!roleNameParam) {
    throw AppError.badRequest("Role name is required");
  }
  const { name, description } = UpdateRoleRequestSchema.parse(req.body);

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
      throw AppError.forbidden("You cannot update this role");
    }
    if (name && !canActorManageRole(actorHighestRole, name)) {
      throw AppError.forbidden("You cannot rename this role to the requested role");
    }

    const updatedRoleResult = await client.query(
      `UPDATE roles
       SET name = $1, description = $2
       WHERE id = $3
       RETURNING id, name, description`,
      [
        name ?? existingRole.name,
        description ?? existingRole.description,
        existingRole.id,
      ],
    );
    if ((updatedRoleResult.rowCount ?? 0) !== 1) {
      throw AppError.badRequest("Role not updated");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "update",
      resourceType: "role",
      resourceId: updatedRoleResult.rows[0].id,
      oldValues: existingRole,
      newValues: updatedRoleResult.rows[0],
    });

    await client.query("COMMIT");

    new AppResponse(200, "Role updated successfully", {
      role: toRole(updatedRoleResult.rows[0]),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { updateRole };
