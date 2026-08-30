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
import { toPost } from "@/contracts/api.mappers.ts";

const listPosts = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "post");
  const { page, pageSize, limit, offset } = parsePaginationQuery(req.query);

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT
         p.id,
         p.title,
         p.content,
         p.owner_id,
         u.fullname AS owner_fullname,
         p.created_at,
         p.behalf_of
       FROM posts p
       JOIN users u ON u.id = p.owner_id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: string }>("SELECT COUNT(*) AS total FROM posts"),
  ]);
  const total = Number(countResult.rows[0]?.total ?? 0);

  new AppResponse(200, "Posts fetched successfully", {
    posts: result.rows.map((post) => toPost(post)),
    pagination: makePaginationMeta(page, pageSize, total),
  }).send(res);
});

export { listPosts };
