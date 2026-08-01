import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { auditDBMutation, checkRolePermissions } from "../../utils/helper.ts";
import { toSession } from "@/contracts/api.mappers.ts";

const revokeSession = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }

  const actorId = parsePositiveInt(req.user.uId, "actorId");
  const sessionId = parsePositiveInt(req.params["sessionId"], "sessionId");
  await checkRolePermissions(actorId, "revoke", "session");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingSessionQuery = await client.query(
      `SELECT
         us.id,
         us.user_id,
         u.fullname AS user_fullname,
         us.expires_at,
         us.revoked_at,
         us.device_info,
         us.created_at
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       WHERE us.id = $1
       FOR UPDATE OF us`,
      [sessionId],
    );

    const existingSession = existingSessionQuery.rows[0];
    if (!existingSession) {
      throw AppError.notFound("Session not found");
    }
    if (existingSession.revoked_at != null || existingSession.expires_at <= new Date()) {
      throw AppError.badRequest("Session is already inactive");
    }

    const revokedSessionQuery = await client.query(
      `WITH revoked_session AS (
         UPDATE user_sessions
         SET revoked_at = NOW(),
             expires_at = NOW(),
             refresh_token_hash = 'REVOKED'
         WHERE id = $1
         RETURNING id, user_id, expires_at, revoked_at, device_info, created_at
       )
       SELECT
         revoked_session.id,
         revoked_session.user_id,
         users.fullname AS user_fullname,
         revoked_session.expires_at,
         revoked_session.revoked_at,
         revoked_session.device_info,
         revoked_session.created_at
       FROM revoked_session
       JOIN users ON users.id = revoked_session.user_id`,
      [sessionId],
    );

    const revokedSession = revokedSessionQuery.rows[0];
    if (!revokedSession) {
      throw AppError.notFound("Session not found");
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "revoke",
      resourceType: "session",
      resourceId: sessionId,
      oldValues: existingSession,
      newValues: revokedSession,
    });

    await client.query("COMMIT");

    new AppResponse(200, "Session revoked successfully", {
      session: toSession(revokedSession),
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { revokeSession };
