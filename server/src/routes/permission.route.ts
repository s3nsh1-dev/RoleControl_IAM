import { Router } from "express";
import {
  createPermission,
  removePermission,
  listPermissions,
} from "../controllers/permission.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "../middleware/authenticatedRateLimiting.middleware.ts";

const permissionRouter: Router = Router();

permissionRouter.use(checkCookieSignature);
permissionRouter.use(authenticatedRateLimiting);

permissionRouter.route("/").get(listPermissions).post(createPermission);
permissionRouter.route("/:permissionId").delete(removePermission);

export { permissionRouter };
