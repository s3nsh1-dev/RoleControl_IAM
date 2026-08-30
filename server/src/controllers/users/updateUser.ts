import { asyncHandler } from "../../utils/asyncHandler.ts";
import { pool } from "../../config/db.connect.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  compareHashStrings,
  generateHashString,
} from "../../utils/encryptStrings.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import {
  auditDBMutation,
  canActorManageRole,
  checkRolePermissions,
  getHighestUserRole,
  sanitizeUserRecord,
} from "../../utils/helper.ts";
import { UpdateUserRequestSchema } from "@/contracts/api.contracts.ts";
import { toUserSummary } from "@/contracts/api.mappers.ts";

const updateUser = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "userId");
  const targetUserId = parsePositiveInt(req.params["userId"], "userId");
  const { fullname, email, oldPassword, newPassword } =
    UpdateUserRequestSchema.parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userQuery = await client.query(
      "SELECT * FROM users WHERE id = $1 FOR UPDATE",
      [targetUserId],
    );
    if ((userQuery.rowCount ?? 0) !== 1) {
      throw AppError.notFound("User not found");
    }

    const existingUser = userQuery.rows[0];
    const actorHighestRole = await getHighestUserRole(actorId, client);
    const targetHighestRole = await getHighestUserRole(targetUserId, client);

    if (actorId !== targetUserId) {
      await checkRolePermissions(actorId, "update", "user");
      if (!actorHighestRole) {
        throw AppError.forbidden("Actor does not have an assigned role");
      }
      if (
        targetHighestRole &&
        !canActorManageRole(actorHighestRole, targetHighestRole)
      ) {
        throw AppError.forbidden("You cannot update this user");
      }
    }

    if (oldPassword && !newPassword) {
      throw AppError.badRequest(
        "New password is required when old password is provided",
      );
    }

    let passwordToStore = existingUser.password;
    if (newPassword) {
      if (actorId === targetUserId) {
        if (!oldPassword) {
          throw AppError.badRequest(
            "Old password is required to change your password",
          );
        }
        const verifyPassword = await compareHashStrings(
          oldPassword,
          existingUser.password,
        );
        if (!verifyPassword) {
          throw AppError.unauthorized("Incorrect password");
        }
      }

      passwordToStore = await generateHashString(newPassword);
    }

    const updatedUser = await client.query(
      `UPDATE users
       SET fullname = $1, email = $2, password = $3
       WHERE id = $4
       RETURNING *`,
      [
        fullname ?? existingUser.fullname,
        email ?? existingUser.email,
        passwordToStore,
        targetUserId,
      ],
    );
    if ((updatedUser.rowCount ?? 0) !== 1) {
      throw AppError.badRequest("User not updated");
    }

    const safeExistingUser = sanitizeUserRecord(existingUser);
    const safeUpdatedUser = sanitizeUserRecord(updatedUser.rows[0]);
    await auditDBMutation({
      db: client,
      actorId,
      actionType: "update",
      resourceType: "user",
      resourceId: targetUserId,
      oldValues: safeExistingUser,
      newValues: safeUpdatedUser,
      metadata: newPassword ? { passwordChanged: true } : null,
    });

    await client.query("COMMIT");

    new AppResponse(200, "User updated successfully", {
      user: toUserSummary(safeUpdatedUser),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { updateUser };
