import { Router } from "express";
import {
  viewUser,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/users.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "@/middleware/authenticatedRateLimiting.middleware.ts";

const userRouter: Router = Router();

userRouter.use(checkCookieSignature);
userRouter.use(authenticatedRateLimiting);

userRouter.route("/").get(listUsers).post(createUser);
userRouter.route("/:userId").get(viewUser).put(updateUser).delete(deleteUser);

export { userRouter };
