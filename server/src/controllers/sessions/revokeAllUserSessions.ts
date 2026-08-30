import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { auditDBMutation, checkRolePermissions } from "../../utils/helper.ts";

const revokeAllUserSessions = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  const targetUserId = parsePositiveInt(req.params["userId"], "userId");
  await checkRolePermissions(actorId, "delete", "session");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const activeSessionsQuery = await client.query<{ id: number }>(
      `SELECT id
       FROM user_sessions
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at ASC, id ASC
       FOR UPDATE`,
      [targetUserId],
    );

    const revokedSessionIds = activeSessionsQuery.rows.map(
      (session) => session.id,
    );

    const revokedSessionsQuery = await client.query<{ id: number }>(
      `UPDATE user_sessions
       SET revoked_at = NOW(),
           expires_at = NOW(),
           refresh_token_hash = 'REVOKED'
       WHERE user_id = $1
         AND id = ANY($2::int[])
       RETURNING id`,
      [targetUserId, revokedSessionIds],
    );

    const revokedCount = revokedSessionsQuery.rowCount ?? 0;

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "delete",
      resourceType: "session",
      resourceId: targetUserId,
      metadata: { revokedCount, revokedSessionIds },
    });

    await client.query("COMMIT");

    new AppResponse(200, "User sessions revoked successfully", {
      revokedCount,
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { revokeAllUserSessions };
