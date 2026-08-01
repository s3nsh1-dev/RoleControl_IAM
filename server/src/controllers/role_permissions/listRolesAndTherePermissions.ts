import { asyncHandler } from "@/utils/asyncHandler.ts";
import { AppResponse } from "@/utils/AppResponse.ts";
import { AppError } from "@/utils/AppError.ts";
import { pool } from "@/config/db.connect.ts";
import { checkRolePermissions } from "@/utils/helper.ts";
import {
  makePaginationMeta,
  parsePaginationQuery,
  parsePositiveInt,
} from "@/utils/validation.util.ts";
import { toRolePermissionAssignment } from "@/contracts/api.mappers.ts";

const listRolesAndTherePermissions = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("UNAUTHORIZED REQUEST: USER NOT FOUND");
  }
  const actorId = parsePositiveInt(req.user.uId, "Actor Id");
  await checkRolePermissions(actorId, "view", "permission");
  await checkRolePermissions(actorId, "view", "role");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [rolePermList, countResult] = await Promise.all([
    pool.query(
      `SELECT
         rp.id,
         r.id AS role_id,
         r.name AS role_name,
         r.description AS role_description,
         p.id AS permission_id,
         p.action,
         p.resource,
         p.description AS permission_description
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       ORDER BY rp.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: string }>(
      "SELECT COUNT(*) AS total FROM role_permissions",
    ),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(
    200,
    "Role permissions fetched successfully",
    {
      assignments: rolePermList.rows.map((row) =>
        toRolePermissionAssignment(
          { id: row.id },
          {
            id: row.role_id,
            name: row.role_name,
            description: row.role_description,
          },
          {
            id: row.permission_id,
            action: row.action,
            resource: row.resource,
            description: row.permission_description,
          },
        ),
      ),
      pagination: makePaginationMeta(page, pageSize, total),
    },
  ).send(res);
  return;
});

export { listRolesAndTherePermissions };
