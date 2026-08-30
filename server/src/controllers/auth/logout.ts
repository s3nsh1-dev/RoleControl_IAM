import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { httpOptions } from "../../others/constants.ts";
import { pool } from "../../config/db.connect.ts";
import { verifyToken } from "../../utils/jsonWebTokens.ts";
import type { REFRESH_JWT_PAYLOAD_TYPE } from "../../types/commonTypes.ts";

const authLogout = asyncHandler(async (req, res) => {
  const clearAuthCookies = () => {
    res.clearCookie("access", { ...httpOptions });
    res.clearCookie("refresh", { ...httpOptions });
  };

  const refreshToken: string | undefined = req.cookies["refresh"];
  if (!refreshToken) {
    clearAuthCookies();
    new AppResponse(200, "User logged out successfully").send(res);
    return;
  }

  try {
    const refreshPayload = verifyToken<REFRESH_JWT_PAYLOAD_TYPE>(refreshToken);
    if (refreshPayload.type === "refresh") {
      await pool.query(
        `UPDATE user_sessions
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE id = $1 AND user_id = $2`,
        [refreshPayload.sId, refreshPayload.uId],
      );
    }
  } catch {
    // Logout stays idempotent even when the refresh cookie is stale or invalid.
  } finally {
    clearAuthCookies();
  }

  new AppResponse(200, "User logged out successfully").send(res);
  return;
});

export { authLogout };
