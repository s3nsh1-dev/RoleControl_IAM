import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import {
  makePaginationMeta,
  parsePaginationQuery,
  parsePositiveInt,
} from "../../utils/validation.util.ts";
import { checkRolePermissions } from "../../utils/helper.ts";
import { toSession } from "@/contracts/api.mappers.ts";

const listSessions = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "session");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT
         us.id,
         us.user_id,
         u.fullname AS user_fullname,
         us.expires_at,
         us.revoked_at,
         us.device_info,
         us.created_at
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       ORDER BY us.created_at DESC, us.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: string }>("SELECT COUNT(*) AS total FROM user_sessions"),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(200, "Sessions fetched successfully", {
    sessions: result.rows.map((session) => toSession(session)),
    pagination: makePaginationMeta(page, pageSize, total),
  }).send(res);
});

export { listSessions };
