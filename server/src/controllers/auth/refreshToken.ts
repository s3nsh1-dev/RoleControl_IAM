import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { generateJwtToken } from "../../utils/jsonWebTokens.ts";
import { createUserPayload } from "@/utils/helper.ts";
import { pool } from "../../config/db.connect.ts";
import { httpOptions } from "../../others/constants.ts";
import env from "@/utils/envHelper.ts";
import {
  compareTokenHash,
  generateTokenHash,
} from "@/utils/encryptStrings.ts";
import {
  verifyToken,
  getTokenExpirationDate,
} from "../../utils/jsonWebTokens.ts";
import {
  USER_JWT_PAYLOAD_TYPE,
  REFRESH_JWT_PAYLOAD_TYPE,
} from "@/types/commonTypes.ts";
import {
  allowSlidingWindow,
  isRedisRateLimitReady,
  throwRateLimitError,
} from "@/utils/rateLimit.util.ts";
import { toAuthenticatedUser } from "@/contracts/api.mappers.ts";

const authTokenRefresh = asyncHandler(async (req, res) => {
  // Step1: ask for refreshToken from cookie
  const oldRefreshToken: string = req.cookies["refresh"];
  if (!oldRefreshToken) {
    throw AppError.unauthorized("Refresh token not found, Please login again");
  }

  // Step2: Extract the payload from the refreshToken
  const refreshPayload = verifyToken<REFRESH_JWT_PAYLOAD_TYPE>(oldRefreshToken);
  if (refreshPayload.type !== "refresh") {
    throw AppError.unauthorized("Invalid refresh token, Please login again");
  }
  const userId = refreshPayload.uId;
  const sessionId = refreshPayload.sId;

  if (!isRedisRateLimitReady()) {
    console.warn("Redis is not ready. Bypassing refresh session rate limiter.");
  } else {
    const sessionCheck = await allowSlidingWindow(
      `rate:refresh:session:${sessionId}`,
      env.RATE_LIMIT_REFRESH_SESSION_LIMIT,
      env.RATE_LIMIT_REFRESH_SESSION_WINDOW_MS,
    );

    if (!sessionCheck) {
      console.warn("Refresh session rate limiter degraded. Bypassing request.");
    } else if (!sessionCheck.allowed) {
      throwRateLimitError(
        res,
        sessionCheck.retryAfterMs,
        "Too many refresh attempts for this session. Please try again later.",
      );
    }
  }

  // Step3: Find the user session
  const findUserSession = await pool.query(
    `SELECT id, refresh_token_hash, expires_at, revoked_at
     FROM user_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
  const userSession = findUserSession.rows[0];
  if (!findUserSession.rowCount || findUserSession.rowCount !== 1) {
    throw AppError.notFound("User session not found");
  }
  if (userSession.revoked_at) {
    throw AppError.unauthorized("Session revoked");
  }

  if (userSession.expires_at < new Date()) {
    throw AppError.unauthorized("Session expired");
  }

  // Step4: Compare the refreshToken if matched then generate new access token and refresh token
  const checkRefreshToken = await compareTokenHash(
    oldRefreshToken,
    userSession.refresh_token_hash,
  );
  if (!checkRefreshToken) {
    throw AppError.unauthorized("Invalid refresh token, Please login again");
  }

  // Step5: Create payload.
  const findUser = await pool.query(
    "SELECT id, email, fullname FROM users WHERE id = $1",
    [userId],
  );
  if (!findUser.rowCount || findUser.rowCount !== 1) {
    throw AppError.notFound("User not found");
  }
  const user = findUser.rows[0];
  const newAccessPayload = createUserPayload<USER_JWT_PAYLOAD_TYPE>(
    user,
    "access",
  );
  const newRefreshPayload = createUserPayload<REFRESH_JWT_PAYLOAD_TYPE>(
    { ...user, sessionId },
    "refresh",
  );

  // Step6: Generate new access token and refresh token
  const accessToken = generateJwtToken(
    newAccessPayload,
    env.ACCESS_TOKEN_EXPIRES_IN,
  );
  const refreshToken = generateJwtToken(
    newRefreshPayload,
    env.REFRESH_TOKEN_EXPIRES_IN,
  );

  // Step7: Generate new refresh token hash and update the db
  const refreshExpirationDate =
    getTokenExpirationDate<REFRESH_JWT_PAYLOAD_TYPE>(refreshToken);
  const newRefreshTokenHash = await generateTokenHash(refreshToken);
  const updateRefreshToken = await pool.query(
    `UPDATE user_sessions
     SET refresh_token_hash = $1, expires_at = $2
     WHERE id = $3 AND user_id = $4 AND refresh_token_hash = $5
     RETURNING *`,
    [
      newRefreshTokenHash,
      refreshExpirationDate,
      sessionId,
      userId,
      userSession.refresh_token_hash,
    ],
  );
  if (!updateRefreshToken.rowCount || updateRefreshToken.rowCount !== 1) {
    throw AppError.badRequest("Failed to update refresh token");
  }

  // Step8: Set the signed token in the cookie
  res.cookie("access", accessToken, { ...httpOptions });
  res.cookie("refresh", refreshToken, { ...httpOptions });
  new AppResponse(200, "Tokens refreshed successfully", {
    user: toAuthenticatedUser(user),
  }).send(res);
  return;
});

export { authTokenRefresh };
