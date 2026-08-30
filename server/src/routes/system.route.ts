import { Router } from "express";
import { listMigrations } from "../controllers/system.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "../middleware/authenticatedRateLimiting.middleware.ts";

const systemRouter: Router = Router();

systemRouter.use(checkCookieSignature);
systemRouter.use(authenticatedRateLimiting);

systemRouter.route("/migrations").get(listMigrations);

export { systemRouter };
