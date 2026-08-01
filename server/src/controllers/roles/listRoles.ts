import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { checkRolePermissions } from "../../utils/helper.ts";
import {
  makePaginationMeta,
  parsePaginationQuery,
  parsePositiveInt,
} from "../../utils/validation.util.ts";
import { toRole } from "@/contracts/api.mappers.ts";

const listAllRoles = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "role");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [result, countResult] = await Promise.all([
    pool.query(
      "SELECT id, name, description FROM roles ORDER BY id DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    ),
    pool.query<{ total: string }>("SELECT COUNT(*) AS total FROM roles"),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(200, "Roles listed successfully", {
    roles: result.rows.map((role) => toRole(role)),
    pagination: makePaginationMeta(page, pageSize, total),
  }).send(res);
});

export { listAllRoles };
