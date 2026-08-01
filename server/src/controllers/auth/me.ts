import { toAuthenticatedUser, toCapabilityKeys } from "@/contracts/api.mappers.ts";
import { pool } from "@/config/db.connect.ts";
import { AppError } from "@/utils/AppError.ts";
import { AppResponse } from "@/utils/AppResponse.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import {
  getUserEffectivePermissions,
  getUserRoleNames,
  sanitizeUserRecord,
} from "@/utils/helper.ts";
import { parsePositiveInt } from "@/utils/validation.util.ts";

const authMe = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");

  const userResult = await pool.query(
    `SELECT id, fullname, email
     FROM users
     WHERE id = $1`,
    [actorId],
  );

  if ((userResult.rowCount ?? 0) !== 1) {
    throw AppError.notFound("User not found");
  }

  const user = userResult.rows[0];
  if (!user) {
    throw AppError.notFound("User not found");
  }

  const [roles, permissions] = await Promise.all([
    getUserRoleNames(actorId),
    getUserEffectivePermissions(actorId),
  ]);

  new AppResponse(200, "Authenticated user fetched successfully", {
    user: toAuthenticatedUser(sanitizeUserRecord(user)),
    roles,
    capabilities: toCapabilityKeys(permissions),
  }).send(res);
});

export { authMe };
