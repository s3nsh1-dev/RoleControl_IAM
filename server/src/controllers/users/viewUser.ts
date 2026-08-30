import { asyncHandler } from "../../utils/asyncHandler.ts";
import { pool } from "../../config/db.connect.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { AppError } from "../../utils/AppError.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { checkRolePermissions, sanitizeUserRecord } from "../../utils/helper.ts";
import { toUserSummary } from "@/contracts/api.mappers.ts";

const viewUser = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "user");

  const userId = parsePositiveInt(req.params["userId"], "userId");
  const userQuery = await pool.query(
    `SELECT id, fullname, email, is_active, created_at, created_by
     FROM users
     WHERE id = $1`,
    [userId],
  );
  if ((userQuery.rowCount ?? 0) !== 1) {
    throw AppError.notFound("User not found");
  }

  new AppResponse(
    200,
    "User fetched successfully",
    {
      user: toUserSummary(
        sanitizeUserRecord(userQuery.rows[0]) as Record<string, unknown>,
      ),
    },
  ).send(res);
});

export { viewUser };
