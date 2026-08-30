import { Router } from "express";
import { listAuditLogs } from "../controllers/audit_logs.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "../middleware/authenticatedRateLimiting.middleware.ts";

const auditLogRouter: Router = Router();

auditLogRouter.use(checkCookieSignature);
auditLogRouter.use(authenticatedRateLimiting);

auditLogRouter.route("/").get(listAuditLogs);

export { auditLogRouter };
