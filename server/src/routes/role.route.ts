import { Router } from "express";
import {
  createRole,
  deleteRole,
  listAllRoles,
  updateRole,
} from "../controllers/roles.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "@/middleware/authenticatedRateLimiting.middleware.ts";

const roleRouter: Router = Router();

roleRouter.use(checkCookieSignature);
roleRouter.use(authenticatedRateLimiting);

roleRouter.route("/").get(listAllRoles).post(createRole);
roleRouter.route("/:roleName").put(updateRole).delete(deleteRole);

export { roleRouter };
