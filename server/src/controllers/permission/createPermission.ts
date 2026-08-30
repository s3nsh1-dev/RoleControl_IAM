import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { checkRolePermissions } from "@/utils/helper.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { auditDBMutation } from "@/utils/helper.ts";
import { CreatePermissionRequestSchema } from "@/contracts/api.contracts.ts";
import { toPermission } from "@/contracts/api.mappers.ts";

const createPermission = asyncHandler(async (req, res) => {
  // The full permission schema includes `id`, but for create requests
  // the client should only send: action, resource, description.
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  // Step 2: get actor id from JWT payload
  const actorId = parsePositiveInt(req.user.uId, "actorId");

  // Step 3: authorization check
  await checkRolePermissions(actorId, "create", "permission");

  // Step 4: validate request body
  const { action, resource, description } =
    CreatePermissionRequestSchema.parse(req.body);

  // Step 5: insert the new permission row
  // `RETURNING` gives us the created record back immediately.
  const result = await pool.query(
    `INSERT INTO permissions (action, resource, description)
       VALUES ($1, $2, $3)
       RETURNING id, action, resource, description`,
    [action, resource, description],
  );
  if (result.rowCount === 0) {
    throw AppError.badRequest("Permission not created");
  }
  await auditDBMutation({
    actorId,
    actionType: "create",
    resourceType: "permission",
    resourceId: result.rows[0].id,
    newValues: result.rows[0],
  });

  // Step 6: send success response
  // 201 is correct because a new resource was created.
  new AppResponse(201, "Permission created successfully", {
    permission: toPermission(result.rows[0]),
  }).send(res);
});

export { createPermission };
