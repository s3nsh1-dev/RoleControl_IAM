import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { checkRolePermissions, sanitizeUserRecord } from "../../utils/helper.ts";
import {
  makePaginationMeta,
  parsePaginationQuery,
  parsePositiveInt,
} from "../../utils/validation.util.ts";
import { toUserListItem } from "@/contracts/api.mappers.ts";

const listUsers = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "user");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT
         u.id,
         u.fullname,
         u.email,
         u.is_active,
         u.created_at,
         u.created_by,
         COALESCE(
           ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL),
           ARRAY[]::text[]
         ) AS role_names
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: string }>("SELECT COUNT(*) AS total FROM users"),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(
    200,
    "Users fetched successfully",
    {
      users: result.rows.map((user) =>
        toUserListItem(sanitizeUserRecord(user) as Record<string, unknown>),
      ),
      pagination: makePaginationMeta(page, pageSize, total),
    },
  ).send(res);
});

export { listUsers };
