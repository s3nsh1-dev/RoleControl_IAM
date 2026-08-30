import { Router } from "express";
import {
  assignRole,
  revokeRole,
} from "../controllers/user_roles.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "@/middleware/authenticatedRateLimiting.middleware.ts";

const userRolesRouter: Router = Router();

userRolesRouter.use(checkCookieSignature);
userRolesRouter.use(authenticatedRateLimiting);

userRolesRouter.route("/:userId").post(assignRole).delete(revokeRole);

export { userRolesRouter };
