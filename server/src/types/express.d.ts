import type { USER_JWT_PAYLOAD_TYPE } from "./commonTypes.ts";

declare global {
  interface Error {
    statusCode?: number;
  }
  namespace Express {
    interface Request {
      user: USER_JWT_PAYLOAD_TYPE;
    }
  }
}

export {};
