import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { checkRolePermissions } from "@/utils/helper.ts";
import {
  makePaginationMeta,
  parsePaginationQuery,
  parsePositiveInt,
} from "../../utils/validation.util.ts";
import { toPermission } from "@/contracts/api.mappers.ts";

const listPermissions = asyncHandler(async (req, res) => {
  // Step 1: ensure the request has an authenticated user payload
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  // Step 2: extract actor id from JWT payload
  const actorId = parsePositiveInt(req.user.uId, "actorId");

  // Step 3: authorization check
  await checkRolePermissions(actorId, "view", "permission");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [result, countResult] = await Promise.all([
    pool.query(
      "SELECT id, action, resource, description FROM permissions ORDER BY id DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    ),
    pool.query<{ total: string }>("SELECT COUNT(*) AS total FROM permissions"),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(200, "Permissions fetched successfully", {
    permissions: result.rows.map((permission) => toPermission(permission)),
    pagination: makePaginationMeta(page, pageSize, total),
  }).send(res);
});

export { listPermissions };
