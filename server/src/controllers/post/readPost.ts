import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { checkRolePermissions } from "../../utils/helper.ts";
import { toPost } from "@/contracts/api.mappers.ts";

const readPost = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  await checkRolePermissions(actorId, "view", "post");

  const postId = parsePositiveInt(req.params["postId"], "postId");

  const result = await pool.query(
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
     WHERE p.id = $1`,
    [postId],
  );

  const post = result.rows[0];
  if (!post) {
    throw AppError.notFound("Post not found");
  }

  new AppResponse(200, "Post fetched successfully", {
    post: toPost(post),
  }).send(res);
});

export { readPost };
