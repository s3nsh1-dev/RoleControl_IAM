import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { pool } from "../../config/db.connect.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { checkRolePermissions } from "../../utils/helper.ts";
import { auditDBMutation } from "../../utils/helper.ts";
import { PostWriteRequestSchema } from "@/contracts/api.contracts.ts";
import { toPost } from "@/contracts/api.mappers.ts";

const createPostOnBehalf = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  const targetUserId = parsePositiveInt(req.params["userId"], "userId");
  if (actorId === targetUserId) {
    throw AppError.badRequest(
      "Use the regular create post endpoint to create your own post",
    );
  }
  const { title, content } = PostWriteRequestSchema.parse(req.body);

  const targetUserQuery = await pool.query(
    "SELECT 1 FROM users WHERE id = $1 LIMIT 1",
    [targetUserId],
  );
  if ((targetUserQuery.rowCount ?? 0) === 0) {
    throw AppError.notFound("Target user not found");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await checkRolePermissions(actorId, "createOnBehalf", "post");
    const newOnBehalfPost = await client.query(
      `WITH inserted_post AS (
         INSERT INTO posts (title, content, owner_id, behalf_of)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, content, owner_id, created_at, behalf_of
       )
       SELECT
         inserted_post.id,
         inserted_post.title,
         inserted_post.content,
         inserted_post.owner_id,
         users.fullname AS owner_fullname,
         inserted_post.created_at,
         inserted_post.behalf_of
       FROM inserted_post
       JOIN users ON users.id = inserted_post.owner_id`,
      [title, content ?? null, targetUserId, actorId],
    );
    if ((newOnBehalfPost.rowCount ?? 0) !== 1) {
      throw AppError.badRequest("Post not created");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "createOnBehalf",
      resourceType: "post",
      resourceId: newOnBehalfPost.rows[0].id,
      newValues: newOnBehalfPost.rows[0],
    });

    await client.query("COMMIT");

    new AppResponse(201, "Post created successfully on behalf of user", {
      post: toPost(newOnBehalfPost.rows[0]),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { createPostOnBehalf };

/**
 * 1. check who is creating the post, take his userid
 * 2. does he have the permission to createOnBehalf post
 * 3. create and send response
 */
