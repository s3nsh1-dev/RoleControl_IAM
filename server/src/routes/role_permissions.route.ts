import { Router } from "express";
import {
  assignPermission,
  revokePermission,
  listRolesAndTherePermissions,
} from "../controllers/roles_permissions.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "@/middleware/authenticatedRateLimiting.middleware.ts";

const rolePermissionsRouter: Router = Router();

rolePermissionsRouter.use(checkCookieSignature);
rolePermissionsRouter.use(authenticatedRateLimiting);

rolePermissionsRouter
  .route("/")
  .get(listRolesAndTherePermissions)
  .post(assignPermission)
  .delete(revokePermission);

export { rolePermissionsRouter };
