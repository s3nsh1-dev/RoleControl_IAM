import { asyncHandler } from "../../utils/asyncHandler.ts";
import { pool } from "../../config/db.connect.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  auditDBMutation,
  canActorManageRole,
  checkRolePermissions,
  getHighestUserRole,
  sanitizeUserRecord,
} from "../../utils/helper.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { toUserSummary } from "@/contracts/api.mappers.ts";

const deleteUser = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }
  const actorId = parsePositiveInt(req.user.uId, "actorId");
  const targetUserId = parsePositiveInt(req.params["userId"], "userId");
  if (actorId === targetUserId) {
    throw AppError.forbidden("You cannot delete yourself");
  }

  await checkRolePermissions(actorId, "delete", "user");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingUserQuery = await client.query(
      "SELECT * FROM users WHERE id = $1 FOR UPDATE",
      [targetUserId],
    );
    if ((existingUserQuery.rowCount ?? 0) !== 1) {
      throw AppError.notFound("User not found or already deleted");
    }

    const actorHighestRole = await getHighestUserRole(actorId, client);
    const targetHighestRole = await getHighestUserRole(targetUserId, client);
    if (!actorHighestRole) {
      throw AppError.forbidden("Actor does not have an assigned role");
    }
    if (targetHighestRole && !canActorManageRole(actorHighestRole, targetHighestRole)) {
      throw AppError.forbidden("You cannot delete this user");
    }
    if (targetHighestRole === "super-admin") {
      const superAdminCount = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'super-admin'`,
      );
      if ((superAdminCount.rows[0]?.count ?? 0) <= 1) {
        throw AppError.forbidden("Cannot delete the last super-admin");
      }
    }

    const deletedUserQuery = await client.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [targetUserId],
    );
    if ((deletedUserQuery.rowCount ?? 0) !== 1) {
      throw AppError.notFound("User not found or already deleted");
    }

    const deletedUser = deletedUserQuery.rows[0];
    const safeDeletedUser = sanitizeUserRecord(deletedUser);
    await auditDBMutation({
      db: client,
      actorId,
      actionType: "delete",
      resourceType: "user",
      resourceId: deletedUser.id,
      oldValues: safeDeletedUser,
    });

    await client.query("COMMIT");

    new AppResponse(200, "User deleted successfully", {
      user: toUserSummary(safeDeletedUser),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { deleteUser };
