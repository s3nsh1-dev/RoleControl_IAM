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
import { toMigration } from "@/contracts/api.mappers.ts";

const listMigrations = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "migration");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT id, name, run_on
       FROM pgmigrations
       ORDER BY id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: string }>("SELECT COUNT(*) AS total FROM pgmigrations"),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(200, "Migrations fetched successfully", {
    migrations: result.rows.map((migration) => toMigration(migration)),
    pagination: makePaginationMeta(page, pageSize, total),
  }).send(res);
});

export { listMigrations };
