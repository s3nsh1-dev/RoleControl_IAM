import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { auditDBMutation, checkRolePermissions } from "../../utils/helper.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { CreateRoleRequestSchema } from "@/contracts/api.contracts.ts";
import { toRole } from "@/contracts/api.mappers.ts";

const createRole = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "create", "role");

  const { name, description } = CreateRoleRequestSchema.parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const createdRole = await client.query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description`,
      [name, description ?? null],
    );
    if ((createdRole.rowCount ?? 0) !== 1) {
      throw AppError.badRequest("Role not created");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "create",
      resourceType: "role",
      resourceId: createdRole.rows[0].id,
      newValues: createdRole.rows[0],
    });

    await client.query("COMMIT");

    new AppResponse(201, "Role created successfully", {
      role: toRole(createdRole.rows[0]),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { createRole };
