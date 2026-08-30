import { Router } from "express";
import {
  authLogin,
  authLogout,
  authMe,
  authRegistration,
  authTokenRefresh,
} from "../controllers/auth.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { loginRateLimiting } from "../middleware/loginRateLimiting.middleware.ts";
import { refreshRateLimiting } from "../middleware/refreshRateLimiting.middleware.ts";

const authRouter: Router = Router();
const authExemptRouter: Router = Router();
const authProtectedRouter: Router = Router();

authExemptRouter.route("/login").post(loginRateLimiting, authLogin);
authExemptRouter.route("/refresh").get(refreshRateLimiting, authTokenRefresh);

authProtectedRouter.route("/logout").post(authLogout);
authProtectedRouter.route("/me").get(checkCookieSignature, authMe);
// this router is taken only when we want to create a super-admin for the very first time, when done close the router as super-admin will have access to create another user and assign him roles like ["super-admin", "editor","admin"]. user role we be assigned to everyone
authProtectedRouter.route("/register").post(authRegistration);

authRouter.use(authExemptRouter);
authRouter.use(authProtectedRouter);

export { authRouter, authExemptRouter, authProtectedRouter };
