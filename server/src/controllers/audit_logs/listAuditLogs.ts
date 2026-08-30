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
import { toAuditLog } from "@/contracts/api.mappers.ts";

const listAuditLogs = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "audit_log");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT
         al.id,
         al.actor_id,
         u.fullname AS actor_fullname,
         al.action_type,
         al.resource_type,
         al.resource_id,
         al.old_values,
         al.new_values,
         al.metadata,
         al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: string }>("SELECT COUNT(*) AS total FROM audit_logs"),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(200, "Audit logs fetched successfully", {
    auditLogs: result.rows.map((auditLog) => toAuditLog(auditLog)),
    pagination: makePaginationMeta(page, pageSize, total),
  }).send(res);
});

export { listAuditLogs };
