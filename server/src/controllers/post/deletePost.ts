import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { pool } from "../../config/db.connect.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import {
  auditDBMutation,
  checkRolePermissions,
  sortRoleBasedOnRanks,
} from "../../utils/helper.ts";
import type { ROLES_TYPES } from "../../types/commonTypes.ts";
import { toPost } from "@/contracts/api.mappers.ts";

const deletePost = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  const postId = parsePositiveInt(req.params["postId"], "postId");
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

    // admin and super-admin can delete any post
    await checkRolePermissions(actorId, "delete", "post");

    const actorRolesQuery = await client.query<{ name: ROLES_TYPES }>(
      `SELECT r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
      [actorId],
    );
    const ownerRolesQuery = await client.query<{ name: ROLES_TYPES }>(
      `SELECT r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
      [existingPost.owner_id],
    );

    const actorRoles = actorRolesQuery.rows.map((row) => row.name);
    const ownerRoles = ownerRolesQuery.rows.map((row) => row.name);

    const highestActorRole = sortRoleBasedOnRanks(actorRoles)[0];
    const highestOwnerRole = sortRoleBasedOnRanks(ownerRoles)[0];

    if (!highestActorRole) {
      throw AppError.forbidden("Actor does not have an assigned role");
    }

    if (!highestOwnerRole) {
      throw AppError.forbidden("Post owner does not have an assigned role");
    }

    if (highestActorRole === "admin" && highestOwnerRole === "super-admin") {
      throw AppError.forbidden(
        "Admin cannot delete a post owned by a super-admin",
      );
    }

    const result = await client.query(
      `DELETE FROM posts
       WHERE id = $1
       RETURNING id, title, content, owner_id, created_at, behalf_of`,
      [postId],
    );

    const post = result.rows[0];
    if (!post) {
      throw AppError.notFound("Post not found");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "delete",
      resourceType: "post",
      resourceId: post.id,
      oldValues: existingPost,
      newValues: null,
    });

    await client.query("COMMIT");

    new AppResponse(200, "Post deleted successfully", {
      post: toPost(post),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { deletePost };

/**
 * conditions
 * 1. an admin not delete the post of a super-admin but any super-admin can delete any post even other super-admin
 * 2. an admin can also delete the post of himself and other admins
 */
