import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { pool } from "../../config/db.connect.ts";
import { parsePositiveInt } from "@/utils/validation.util.ts";
import { checkRolePermissions } from "@/utils/helper.ts";
import { auditDBMutation } from "@/utils/helper.ts";
import { PostWriteRequestSchema } from "@/contracts/api.contracts.ts";
import { toPost } from "@/contracts/api.mappers.ts";

const createPost = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actor_id");

  const { title, content } = PostWriteRequestSchema.parse(req.body);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await checkRolePermissions(actorId, "create", "post");
    const newPost = await client.query(
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
      [title, content ?? null, actorId, null],
    );

    if ((newPost.rowCount ?? 0) !== 1) {
      throw AppError.badRequest("Post not created");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "create",
      resourceType: "post",
      resourceId: newPost.rows[0].id,
      newValues: newPost.rows[0],
    });

    await client.query("COMMIT");

    new AppResponse(201, "Post created successfully", {
      post: toPost(newPost.rows[0]),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { createPost };
