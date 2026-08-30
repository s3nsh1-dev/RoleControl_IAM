import type { PoolClient } from "pg";
import { AppError } from "./AppError.ts";

const enforceSessionRowCapPerUser = async (
  client: PoolClient,
  userId: number,
  maxSessionRowsPerUser: number,
) => {
  const existingSessions = await client.query<{
    id: number;
    created_at: Date;
  }>(
    `SELECT id, created_at
     FROM user_sessions
     WHERE user_id = $1
     ORDER BY created_at ASC, id ASC
     FOR UPDATE`,
    [userId],
  );

  const sessionsToDelete =
    existingSessions.rows.length - (maxSessionRowsPerUser - 1);
  if (sessionsToDelete <= 0) {
    return;
  }

  const oldestSessionIds = existingSessions.rows
    .slice(0, sessionsToDelete)
    .map((session) => session.id);

  const deletedSessions = await client.query(
    `DELETE FROM user_sessions
     WHERE user_id = $1 AND id = ANY($2::int[])
     RETURNING id`,
    [userId, oldestSessionIds],
  );

  if ((deletedSessions.rowCount ?? 0) !== oldestSessionIds.length) {
    throw AppError.internal("Something went wrong while deleting old sessions");
  }
};

export { enforceSessionRowCapPerUser };
