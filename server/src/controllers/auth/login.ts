import { asyncHandler } from "../../utils/asyncHandler.ts";
import { pool } from "../../config/db.connect.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  compareHashStrings,
  generateTokenHash,
} from "../../utils/encryptStrings.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import {
  generateJwtToken,
  getTokenExpirationDate,
} from "../../utils/jsonWebTokens.ts";
import { httpOptions } from "../../others/constants.ts";
import { createUserPayload } from "@/utils/helper.ts";
import env from "@/utils/envHelper.ts";
import {
  REFRESH_JWT_PAYLOAD_TYPE,
  USER_JWT_PAYLOAD_TYPE,
} from "@/types/commonTypes.ts";
import { enforceSessionRowCapPerUser } from "@/utils/session.util.ts";
import { parseEmail } from "@/utils/validation.util.ts";
import {
  allowSlidingWindow,
  clearRateLimitKey,
  getTrustedClientIp,
  isRedisRateLimitReady,
  throwRateLimitError,
} from "@/utils/rateLimit.util.ts";
import { hashSha256 } from "@/utils/encryptStrings.ts";
import { AuthLoginRequestSchema } from "@/contracts/api.contracts.ts";
import { toAuthenticatedUser } from "@/contracts/api.mappers.ts";

const MAX_SESSION_ROWS_PER_USER = 2;
const INVALID_LOGIN_MESSAGE = "Invalid email or password";

const authLogin = asyncHandler(async (req, res) => {
  // Step1: Take User input
  const { email, password: unencryptedPassword } =
    AuthLoginRequestSchema.parse(req.body);
  const normalizedEmail = parseEmail(email);
  const clientIp = getTrustedClientIp(req);
  const loginFailureKey = buildLoginFailureKey(normalizedEmail, clientIp);

  // Step2: Validate User input
  if (!email || !unencryptedPassword) {
    throw AppError.badRequest("Email and password are required");
  }
  const registerFailedLoginAttempt = async () => {
    if (!isRedisRateLimitReady()) {
      console.warn("Redis is not ready. Bypassing login failure rate limiter.");
      return;
    }

    const failureCheck = await allowSlidingWindow(
      loginFailureKey,
      env.RATE_LIMIT_LOGIN_FAIL_LIMIT,
      env.RATE_LIMIT_LOGIN_FAIL_WINDOW_MS,
    );

    if (!failureCheck) {
      console.warn("Login failure rate limiter degraded. Bypassing request.");
      return;
    }

    if (!failureCheck.allowed) {
      throwRateLimitError(
        res,
        failureCheck.retryAfterMs,
        "Too many failed login attempts. Please try again later.",
      );
    }
  };

  const userInfo = await pool.query("SELECT * FROM users WHERE email = $1", [
    normalizedEmail,
  ]);
  if (userInfo.rows.length === 0) {
    await registerFailedLoginAttempt();
    throw AppError.unauthorized(INVALID_LOGIN_MESSAGE);
  }
  const user = userInfo.rows[0];

  // Step3: Validate Password
  const isPasswordValid = await compareHashStrings(
    unencryptedPassword,
    user.password,
  );
  if (!isPasswordValid) {
    await registerFailedLoginAttempt();
    throw AppError.unauthorized(INVALID_LOGIN_MESSAGE);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
      user.id,
    ]);
    await enforceSessionRowCapPerUser(
      client,
      user.id,
      MAX_SESSION_ROWS_PER_USER,
    );

    const sessionResult = await client.query<{ id: number }>(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, expires_at, device_info)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user.id, "pending", new Date(), req.get("user-agent") ?? null],
    );
    const sessionId = sessionResult.rows[0]?.id;
    if (!sessionId) {
      throw AppError.internal("Failed to create a user session");
    }

    // Step4: Create Payload
    const accessPayload = createUserPayload<USER_JWT_PAYLOAD_TYPE>(
      user,
      "access",
    );
    const refreshPayload = createUserPayload<REFRESH_JWT_PAYLOAD_TYPE>(
      {
        ...user,
        sessionId,
      },
      "refresh",
    );

    // Step5: Generate JWT Token
    const accessToken = generateJwtToken(
      accessPayload,
      env.ACCESS_TOKEN_EXPIRES_IN,
    );
    const refreshToken = generateJwtToken(
      refreshPayload,
      env.REFRESH_TOKEN_EXPIRES_IN,
    );
    const refreshTokenHash = await generateTokenHash(refreshToken);
    const refreshExpiresAt =
      getTokenExpirationDate<REFRESH_JWT_PAYLOAD_TYPE>(refreshToken);

    const persistedSession = await client.query(
      `UPDATE user_sessions
       SET refresh_token_hash = $1, expires_at = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id`,
      [refreshTokenHash, refreshExpiresAt, sessionId, user.id],
    );
    if ((persistedSession.rowCount ?? 0) !== 1) {
      throw AppError.internal("Failed to persist the user session");
    }

    await client.query("COMMIT");
    await clearRateLimitKey(loginFailureKey);

    // Step6: Set the signed token in the cookie
    res.cookie("access", accessToken, { ...httpOptions });
    res.cookie("refresh", refreshToken, { ...httpOptions });

    new AppResponse(200, "User logged in successfully", {
      user: toAuthenticatedUser(user),
    }).send(res);
    return;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { authLogin };

const buildLoginFailureKey = (email: string, ip: string) => {
  const hashedIdentity = hashSha256(`${email}|${ip}`);
  return `rate:login:fail:email-ip:${hashedIdentity}`;
};
