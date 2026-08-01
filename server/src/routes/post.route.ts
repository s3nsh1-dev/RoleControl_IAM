import { Router } from "express";
import {
  listPosts,
  readPost,
  createPost,
  createPostOnBehalf,
  updatePost,
  deletePost,
} from "../controllers/post.controller.ts";
import { checkCookieSignature } from "../middleware/checkCookieSignature.middleware.ts";
import { authenticatedRateLimiting } from "../middleware/authenticatedRateLimiting.middleware.ts";

const postRouter: Router = Router();

postRouter.use(checkCookieSignature);
postRouter.use(authenticatedRateLimiting);

postRouter.route("/").get(listPosts).post(createPost);
postRouter.route("/on-behalf/:userId").post(createPostOnBehalf);
postRouter.route("/:postId").get(readPost).put(updatePost).delete(deletePost);

export { postRouter };
