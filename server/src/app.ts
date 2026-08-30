import express, { type Application } from "express";
import type { Request, Response } from "express";
import { errorHandler } from "./middleware/errorHandler.middleware.ts";
import { notFound } from "./middleware/notFound.middleware.ts";
import { testDbConnection } from "./config/db.connect.ts";
import { userRouter } from "./routes/user.route.ts";
import { roleRouter } from "./routes/role.route.ts";
import { permissionRouter } from "./routes/permission.route.ts";
import { postRouter } from "./routes/post.route.ts";
import { authExemptRouter, authProtectedRouter } from "./routes/auth.route.ts";
import { userRolesRouter } from "./routes/user_roles.route.ts";
import { rolePermissionsRouter } from "./routes/role_permissions.route.ts";
import { auditLogRouter } from "./routes/audit_log.route.ts";
import { systemRouter } from "./routes/system.route.ts";
import { sessionRouter, userSessionRouter } from "./routes/session.route.ts";
import cookieParser from "cookie-parser";
import env from "./utils/envHelper.ts";
import { globalRateLimiting } from "./middleware/globalRateLimiting.middleware.ts";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi/document.ts";

const app: Application = express();

const parseTrustProxy = (value: string) => {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  const numericValue = Number(normalizedValue);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return value;
};

// Parse incoming payloads
app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configurations
testDbConnection();

// Default Route
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello World");
});
app.get("/api/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiDocument);
});
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
    customSiteTitle: "RoleControl IAM API Docs",
  }),
);
app.use("/api/auth", authExemptRouter);
app.use("/api", globalRateLimiting);
app.use("/api/auth", authProtectedRouter);
app.use("/api/users", userRouter);
app.use("/api/roles", roleRouter);
app.use("/api/permissions", permissionRouter);
app.use("/api/user-roles", userRolesRouter);
app.use("/api/role-permissions", rolePermissionsRouter);
app.use("/api/posts", postRouter);
app.use("/api/users/:userId/sessions", userSessionRouter);
app.use("/api/audit-logs", auditLogRouter);
app.use("/api/system", systemRouter);
app.use("/api/sessions", sessionRouter);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

export default app;
