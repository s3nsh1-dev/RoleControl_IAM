import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { checkRolePermissions } from "@/utils/helper.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { auditDBMutation } from "@/utils/helper.ts";
import { toPermission } from "@/contracts/api.mappers.ts";

const removePermission = asyncHandler(async (req, res) => {
  // Step 1: ensure the request has an authenticated user payload
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  // Step 2: extract actor id from JWT payload
  const actorId = parsePositiveInt(req.user.uId, "actorId");

  // Step 3: authorization check
  await checkRolePermissions(actorId, "delete", "permission");

  // Step 4: extract and validate the target permission id
  const permissionId = parsePositiveInt(
    req.params["permissionId"],
    "permissionId",
  );

  // Step 5: delete the permission record
  // Any linked role_permissions rows are removed automatically by ON DELETE CASCADE.
  const deletedPermission = await pool.query(
    `DELETE FROM permissions
     WHERE id = $1
     RETURNING id, action, resource, description`,
    [permissionId],
  );

  // Step 6: if no row came back, the permission id did not exist
  if ((deletedPermission.rowCount ?? 0) === 0) {
    throw AppError.notFound("Permission not found");
  }
  await auditDBMutation({
    actorId,
    actionType: "delete",
    resourceType: "permission",
    resourceId: deletedPermission.rows[0].id,
    oldValues: deletedPermission.rows[0],
    newValues: null,
  });

  // Step 7: send success response with the deleted record
  new AppResponse(200, "Permission removed successfully", {
    permission: toPermission(deletedPermission.rows[0]),
  }).send(res);
});

export { removePermission };
