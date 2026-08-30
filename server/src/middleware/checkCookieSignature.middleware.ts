import { AppError } from "../utils/AppError.ts";
import { asyncMiddleware } from "../utils/asyncMiddleware.ts";
import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jsonWebTokens.ts";
import { USER_JWT_PAYLOAD_TYPE } from "../types/commonTypes.ts";

const checkCookieSignature = asyncMiddleware(async function (
  req: Request,
  _res: Response,
  _next: NextFunction,
) {
  try {
    const accessToken: string = req.cookies["access"];
    const userPayload = verifyToken<USER_JWT_PAYLOAD_TYPE>(accessToken);
    req.user = userPayload;
  } catch (error) {
    // throwing 401
    const errorMessage =
      error instanceof Error ? error.message : "Token verification failed";
    throw AppError.unauthorized(
      "Invalid user session. Please login again. " + errorMessage,
    );
  }
});

export { checkCookieSignature };
