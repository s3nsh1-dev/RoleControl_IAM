import { Router } from "express";
import {
  listSessions,
  listUserSessions,
  revokeAllUserSessions,
  revokeSession,
} from "../controllers/sessions.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "../middleware/authenticatedRateLimiting.middleware.ts";

const sessionRouter: Router = Router();
// nested route app.ts line 80
const userSessionRouter: Router = Router({ mergeParams: true });

sessionRouter.use(checkCookieSignature);
sessionRouter.use(authenticatedRateLimiting);
userSessionRouter.use(checkCookieSignature);
userSessionRouter.use(authenticatedRateLimiting);

sessionRouter.route("/").get(listSessions);
sessionRouter.route("/:sessionId/revoke").patch(revokeSession);

userSessionRouter.route("/").get(listUserSessions);
userSessionRouter.route("/revoke-all").put(revokeAllUserSessions);

export { sessionRouter, userSessionRouter };
