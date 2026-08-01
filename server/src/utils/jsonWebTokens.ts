import jwt, { JwtPayload, SignOptions, VerifyOptions } from "jsonwebtoken";
import { AppError } from "./AppError.ts";
import env from "./envHelper.ts";

const verifyToken = <T extends object>(token: string): VerifiedToken<T> => {
  const options: VerifyOptions = {
    algorithms: ["HS256"],
    issuer: "s3nsh1-dev",
    audience: "RBAC-users",
  };
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, options);
    if (typeof decoded !== "object" || decoded === null || !("uId" in decoded)) {
      throw AppError.unauthorized("Invalid token payload");
    }
    return decoded as VerifiedToken<T>;
  } catch (error) {
    throw AppError.unauthorized(
      "Failed to verify JWT token, Please login again",
    );
  }
};

const generateJwtToken = <T extends object>(
  payload: T,
  expirationDate: NonNullable<SignOptions["expiresIn"]>,
) => {
  const options: SignOptions = {
    expiresIn: expirationDate,
    algorithm: "HS256",
    issuer: "s3nsh1-dev",
    audience: "RBAC-users",
  };
  try {
    return jwt.sign(payload, env.JWT_SECRET, options);
  } catch (error) {
    throw AppError.unauthorized(
      "Failed to generate JWT token, Please login again",
    );
  }
};

const getTokenExpirationDate = <T extends object>(token: string): Date => {
  const verifiedToken = verifyToken<T>(token);
  if (typeof verifiedToken.exp !== "number") {
    throw AppError.internal("JWT token is missing an expiration claim");
  }

  return new Date(verifiedToken.exp * 1000);
};

export { verifyToken, generateJwtToken, getTokenExpirationDate };

type VerifiedToken<T> = T & JwtPayload;
