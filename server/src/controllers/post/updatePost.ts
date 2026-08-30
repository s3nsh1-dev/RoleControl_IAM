import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { auditDBMutation, checkRolePermissions } from "../../utils/helper.ts";
import { PostWriteRequestSchema } from "@/contracts/api.contracts.ts";
import { toPost } from "@/contracts/api.mappers.ts";

const updatePost = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  const postId = parsePositiveInt(req.params["postId"], "postId");
  const { title, content } = PostWriteRequestSchema.parse(req.body);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingPostQuery = await client.query(
      `SELECT id, title, content, owner_id, created_at, behalf_of
       FROM posts
       WHERE id = $1
       FOR UPDATE`,
      [postId],
    );

    const existingPost = existingPostQuery.rows[0];
    if (!existingPost) {
      throw AppError.notFound("Post not found");
    }

    if (actorId !== existingPost.owner_id) {
      await checkRolePermissions(actorId, "update", "post");
    }

    const result = await client.query(
      `WITH updated_post AS (
         UPDATE posts
         SET title = $1, content = $2
         WHERE id = $3
         RETURNING id, title, content, owner_id, created_at, behalf_of
       )
       SELECT
         updated_post.id,
         updated_post.title,
         updated_post.content,
         updated_post.owner_id,
         users.fullname AS owner_fullname,
         updated_post.created_at,
         updated_post.behalf_of
       FROM updated_post
       JOIN users ON users.id = updated_post.owner_id`,
      [title, content ?? null, postId],
    );

    const post = result.rows[0];
    if (!post) {
      throw AppError.notFound("Post not found");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "update",
      resourceType: "post",
      resourceId: post.id,
      oldValues: existingPost,
      newValues: post,
    });

    await client.query("COMMIT");

    new AppResponse(200, "Post updated successfully", {
      post: toPost(post),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { updatePost };
