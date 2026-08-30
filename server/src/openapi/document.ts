import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type ResponseConfig,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import {
  ApiErrorSchema,
  AuthLoginRequestSchema,
  AuthLoginResponseSchema,
  AuthLogoutResponseSchema,
  AuthMeResponseSchema,
  AuthRefreshResponseSchema,
  AuthRegisterRequestSchema,
  AuthRegisterResponseSchema,
  CreatePermissionRequestSchema,
  CreateUserRequestSchema,
  CreateUserResponseSchema,
  CreateRoleRequestSchema,
  ListAuditLogsResponseSchema,
  ListMigrationsResponseSchema,
  ListPermissionsResponseSchema,
  ListPostsResponseSchema,
  ListRolePermissionsResponseSchema,
  ListRolesResponseSchema,
  ListSessionsResponseSchema,
  ListUsersResponseSchema,
  PaginationQuerySchema,
  PermissionIdParamsSchema,
  PermissionResponseSchema,
  PostIdParamsSchema,
  PostResponseSchema,
  PostWriteRequestSchema,
  RoleNameParamsSchema,
  RolePermissionAssignmentResponseSchema,
  RolePermissionMutationRequestSchema,
  RoleResponseSchema,
  SessionIdParamsSchema,
  SessionRevokeAllResponseSchema,
  SessionRevokeResponseSchema,
  UpdateRoleRequestSchema,
  UpdateUserRequestSchema,
  UserIdParamsSchema,
  UserResponseSchema,
  UserRoleAssignmentResponseSchema,
  UserRoleMutationRequestSchema,
} from "@/contracts/api.contracts.ts";

const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent("securitySchemes", "accessCookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "access",
  description: "Signed access JWT cookie required for protected routes.",
});

openApiRegistry.registerComponent("securitySchemes", "refreshCookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "refresh",
  description: "Signed refresh JWT cookie used by the refresh endpoint.",
});

const jsonResponse = (
  description: string,
  schema: any,
  headers?: ResponseConfig["headers"],
): ResponseConfig => {
  const response: ResponseConfig = {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };

  if (headers) {
    response.headers = headers;
  }

  return response;
};

const errorResponse = (
  description: string,
  headers?: ResponseConfig["headers"],
) => jsonResponse(description, ApiErrorSchema, headers);

const retryAfterHeader = {
  "Retry-After": {
    description:
      "Seconds until another request is allowed after a rate-limit response.",
    schema: {
      type: "string" as const,
    },
  },
};

const protectedRouteSecurity = [{ accessCookieAuth: [] }];
const refreshRouteSecurity = [{ refreshCookieAuth: [] }];

const registerRoute = (route: RouteConfig) => {
  openApiRegistry.registerPath(route);
};

registerRoute({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Login and set auth cookies",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: AuthLoginRequestSchema,
        },
      },
    },
  },
  responses: {
    "200": jsonResponse(
      "Authentication succeeded and auth cookies were set.",
      AuthLoginResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("The email or password was invalid."),
    "429": errorResponse(
      "The login endpoint is rate limited.",
      retryAfterHeader,
    ),
  },
});

registerRoute({
  method: "get",
  path: "/api/auth/refresh",
  tags: ["Auth"],
  summary: "Rotate the refresh token and issue a new access cookie",
  security: refreshRouteSecurity,
  responses: {
    "200": jsonResponse(
      "Tokens were refreshed and new cookies were set.",
      AuthRefreshResponseSchema,
    ),
    "401": errorResponse("The refresh cookie was missing or invalid."),
    "404": errorResponse("The user session or user no longer exists."),
    "429": errorResponse(
      "The refresh endpoint is rate limited for the session.",
      retryAfterHeader,
    ),
  },
});

registerRoute({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Clear auth cookies and revoke the refresh session when possible",
  responses: {
    "200": jsonResponse(
      "Logout completed. The operation is idempotent.",
      AuthLogoutResponseSchema,
    ),
  },
});

registerRoute({
  method: "get",
  path: "/api/auth/me",
  tags: ["Auth"],
  summary: "Get the current authenticated user and UI capabilities",
  description:
    "Returns a small current-session access summary derived from database-backed roles and permissions. Roles and capabilities are not stored in JWT payloads.",
  security: protectedRouteSecurity,
  responses: {
    "200": jsonResponse(
      "The current authenticated user and capabilities were fetched successfully.",
      AuthMeResponseSchema,
    ),
    "401": errorResponse("A valid access cookie is required."),
    "404": errorResponse("The authenticated user no longer exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "Bootstrap the first super-admin account",
  description:
    "This endpoint is intended only for the first initialization flow. Once a super-admin exists, registration is locked.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: AuthRegisterRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse(
      "The bootstrap super-admin account was created.",
      AuthRegisterResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "403": errorResponse("Bootstrap registration is already locked."),
    "404": errorResponse("Required default roles were not present."),
    "409": errorResponse("A conflicting record already exists."),
  },
});

registerRoute({
  method: "get",
  path: "/api/users",
  tags: ["Users"],
  summary: "List users",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse("Users were fetched successfully.", ListUsersResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view users."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/users",
  tags: ["Users"],
  summary: "Create a user and assign an initial role",
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse("The user was created successfully.", CreateUserResponseSchema),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to create the user or role assignment."),
    "404": errorResponse("The requested role was not found."),
    "409": errorResponse("A conflicting record already exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/users/{userId}",
  tags: ["Users"],
  summary: "Get one user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
  },
  responses: {
    "200": jsonResponse("The user was fetched successfully.", UserResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view users."),
    "404": errorResponse("The user was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "put",
  path: "/api/users/{userId}",
  tags: ["Users"],
  summary: "Update a user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    "200": jsonResponse("The user was updated successfully.", UserResponseSchema),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor cannot update the target user."),
    "404": errorResponse("The user was not found."),
    "409": errorResponse("A conflicting record already exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "delete",
  path: "/api/users/{userId}",
  tags: ["Users"],
  summary: "Delete a user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
  },
  responses: {
    "200": jsonResponse("The user was deleted successfully.", UserResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor cannot delete the target user."),
    "404": errorResponse("The user was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/roles",
  tags: ["Roles"],
  summary: "List roles",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse("Roles were fetched successfully.", ListRolesResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view roles."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/roles",
  tags: ["Roles"],
  summary: "Create a role",
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse("The role was created successfully.", RoleResponseSchema),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor cannot create the requested role."),
    "409": errorResponse("A conflicting record already exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "put",
  path: "/api/roles/{roleName}",
  tags: ["Roles"],
  summary: "Update a role",
  security: protectedRouteSecurity,
  request: {
    params: RoleNameParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    "200": jsonResponse("The role was updated successfully.", RoleResponseSchema),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor cannot update the target role."),
    "404": errorResponse("The role was not found."),
    "409": errorResponse("A conflicting record already exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "delete",
  path: "/api/roles/{roleName}",
  tags: ["Roles"],
  summary: "Delete a role",
  security: protectedRouteSecurity,
  request: {
    params: RoleNameParamsSchema,
  },
  responses: {
    "200": jsonResponse("The role was deleted successfully.", RoleResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor cannot delete the target role."),
    "404": errorResponse("The role was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/permissions",
  tags: ["Permissions"],
  summary: "List permissions",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse(
      "Permissions were fetched successfully.",
      ListPermissionsResponseSchema,
    ),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view permissions."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/permissions",
  tags: ["Permissions"],
  summary: "Create a permission",
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreatePermissionRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse(
      "The permission was created successfully.",
      PermissionResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to create permissions."),
    "409": errorResponse("A conflicting record already exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "delete",
  path: "/api/permissions/{permissionId}",
  tags: ["Permissions"],
  summary: "Delete a permission",
  security: protectedRouteSecurity,
  request: {
    params: PermissionIdParamsSchema,
  },
  responses: {
    "200": jsonResponse(
      "The permission was deleted successfully.",
      PermissionResponseSchema,
    ),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to delete permissions."),
    "404": errorResponse("The permission was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/user-roles/{userId}",
  tags: ["User Roles"],
  summary: "Assign a role to a user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UserRoleMutationRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse(
      "The role assignment was created successfully.",
      UserRoleAssignmentResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor cannot modify roles for the target user."),
    "404": errorResponse("The user or role was not found."),
    "409": errorResponse("The role assignment already exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "delete",
  path: "/api/user-roles/{userId}",
  tags: ["User Roles"],
  summary: "Revoke a role from a user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UserRoleMutationRequestSchema,
        },
      },
    },
  },
  responses: {
    "200": jsonResponse(
      "The role assignment was removed successfully.",
      UserRoleAssignmentResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor cannot modify roles for the target user."),
    "404": errorResponse("The user, role, or assignment was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/role-permissions",
  tags: ["Role Permissions"],
  summary: "List role-permission assignments",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse(
      "Role-permission assignments were fetched successfully.",
      ListRolePermissionsResponseSchema,
    ),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view role-permission assignments."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/role-permissions",
  tags: ["Role Permissions"],
  summary: "Assign a permission to a role",
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RolePermissionMutationRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse(
      "The role-permission assignment was created successfully.",
      RolePermissionAssignmentResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to assign permissions."),
    "404": errorResponse("The role or permission was not found."),
    "409": errorResponse("The role-permission assignment already exists."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "delete",
  path: "/api/role-permissions",
  tags: ["Role Permissions"],
  summary: "Revoke a permission from a role",
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RolePermissionMutationRequestSchema,
        },
      },
    },
  },
  responses: {
    "200": jsonResponse(
      "The role-permission assignment was removed successfully.",
      RolePermissionAssignmentResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to revoke permissions."),
    "404": errorResponse("The role, permission, or assignment was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/posts",
  tags: ["Posts"],
  summary: "List posts",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse("Posts were fetched successfully.", ListPostsResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view posts."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/posts",
  tags: ["Posts"],
  summary: "Create a post",
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: PostWriteRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse("The post was created successfully.", PostResponseSchema),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to create posts."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "post",
  path: "/api/posts/on-behalf/{userId}",
  tags: ["Posts"],
  summary: "Create a post on behalf of another user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: PostWriteRequestSchema,
        },
      },
    },
  },
  responses: {
    "201": jsonResponse(
      "The post was created successfully on behalf of the target user.",
      PostResponseSchema,
    ),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to create posts on behalf of another user."),
    "404": errorResponse("The target user was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/posts/{postId}",
  tags: ["Posts"],
  summary: "Get one post",
  security: protectedRouteSecurity,
  request: {
    params: PostIdParamsSchema,
  },
  responses: {
    "200": jsonResponse("The post was fetched successfully.", PostResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view posts."),
    "404": errorResponse("The post was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "put",
  path: "/api/posts/{postId}",
  tags: ["Posts"],
  summary: "Update a post",
  security: protectedRouteSecurity,
  request: {
    params: PostIdParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: PostWriteRequestSchema,
        },
      },
    },
  },
  responses: {
    "200": jsonResponse("The post was updated successfully.", PostResponseSchema),
    "400": errorResponse("The request body failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to update the target post."),
    "404": errorResponse("The post was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "delete",
  path: "/api/posts/{postId}",
  tags: ["Posts"],
  summary: "Delete a post",
  security: protectedRouteSecurity,
  request: {
    params: PostIdParamsSchema,
  },
  responses: {
    "200": jsonResponse("The post was deleted successfully.", PostResponseSchema),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to delete the target post."),
    "404": errorResponse("The post was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/audit-logs",
  tags: ["Audit Logs"],
  summary: "List paginated audit logs",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse(
      "Audit logs were fetched successfully.",
      ListAuditLogsResponseSchema,
    ),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view audit logs."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/system/migrations",
  tags: ["System"],
  summary: "List paginated migration records",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse(
      "Migration records were fetched successfully.",
      ListMigrationsResponseSchema,
    ),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view migrations."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/sessions",
  tags: ["Sessions"],
  summary: "List all sessions",
  security: protectedRouteSecurity,
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse(
      "Sessions were fetched successfully.",
      ListSessionsResponseSchema,
    ),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view sessions."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "get",
  path: "/api/users/{userId}/sessions",
  tags: ["Sessions"],
  summary: "List sessions for a specific user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
    query: PaginationQuerySchema,
  },
  responses: {
    "200": jsonResponse(
      "User sessions were fetched successfully.",
      ListSessionsResponseSchema,
    ),
    "400": errorResponse("The request params or query failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to view sessions."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "patch",
  path: "/api/sessions/{sessionId}/revoke",
  tags: ["Sessions"],
  summary: "Revoke a single session",
  security: protectedRouteSecurity,
  request: {
    params: SessionIdParamsSchema,
  },
  responses: {
    "200": jsonResponse(
      "The session was revoked successfully.",
      SessionRevokeResponseSchema,
    ),
    "400": errorResponse("The session is already inactive."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to revoke sessions."),
    "404": errorResponse("The session was not found."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

registerRoute({
  method: "put",
  path: "/api/users/{userId}/sessions/revoke-all",
  tags: ["Sessions"],
  summary: "Revoke all active sessions for a user",
  security: protectedRouteSecurity,
  request: {
    params: UserIdParamsSchema,
  },
  responses: {
    "200": jsonResponse(
      "The user's active sessions were revoked successfully.",
      SessionRevokeAllResponseSchema,
    ),
    "400": errorResponse("The request params failed validation."),
    "401": errorResponse("A valid access cookie is required."),
    "403": errorResponse("The actor lacks permission to revoke all sessions."),
    "429": errorResponse("The route is rate limited.", retryAfterHeader),
  },
});

const openApiGenerator = new OpenApiGeneratorV31(openApiRegistry.definitions);

const openApiDocument: ReturnType<OpenApiGeneratorV31["generateDocument"]> =
  openApiGenerator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "RoleControl IAM API",
    version: "1.0.0",
    description:
      "Cookie-authenticated RoleControl IAM backend with users, roles, permissions, role assignments, and posts.",
  },
  servers: [
    {
      url: "/",
      description: "Relative server root",
    },
  ],
  tags: [
    { name: "Auth" },
    { name: "Users" },
    { name: "Roles" },
    { name: "Permissions" },
    { name: "User Roles" },
    { name: "Role Permissions" },
    { name: "Posts" },
    { name: "Audit Logs" },
    { name: "System" },
    { name: "Sessions" },
  ],
  });

export { openApiDocument };
