import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  ACTIONS_LIST,
  RESOURCES_LIST,
  ROLES_LIST,
} from "@/others/constants.ts";

extendZodWithOpenApi(z);

const ApiTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .openapi("ApiTimestamp", {
    description: "ISO-8601 timestamp in UTC.",
    example: "2026-04-22T10:00:00.000Z",
  });

const ApiErrorDetailSchema = z
  .object({
    code: z.string(),
    path: z.array(z.string()),
    message: z.string(),
  })
  .openapi("ApiErrorDetail");

const ApiErrorSchema = z
  .object({
    success: z.literal(false),
    status: z.enum(["fail", "error"]),
    message: z.string(),
    details: z.array(ApiErrorDetailSchema).optional(),
    trace: z.string().optional(),
  })
  .openapi("ApiError");

const RoleNameSchema = z
  .enum(ROLES_LIST)
  .openapi("RoleName", { example: "editor" });

const PermissionActionSchema = z
  .enum(ACTIONS_LIST)
  .openapi("PermissionAction", { example: "update" });

const PermissionResourceSchema = z
  .enum(RESOURCES_LIST)
  .openapi("PermissionResource", { example: "post" });

const CapabilityKeySchema = z
  .enum([
    "users.view",
    "users.create",
    "users.update",
    "users.delete",
    "users.assignRole",
    "users.revokeRole",
    "roles.view",
    "roles.create",
    "roles.update",
    "roles.delete",
    "permissions.view",
    "permissions.create",
    "permissions.delete",
    "rolePermissions.view",
    "rolePermissions.assign",
    "rolePermissions.revoke",
    "posts.view",
    "posts.create",
    "posts.update",
    "posts.delete",
    "posts.createOnBehalf",
    "auditLogs.view",
    "migrations.view",
    "sessions.view",
    "sessions.revoke",
    "sessions.delete",
  ])
  .openapi("CapabilityKey", { example: "users.create" });

const AuthenticatedUserSchema = z
  .object({
    id: z.number().int().positive(),
    fullname: z.string(),
    email: z.string().email(),
  })
  .openapi("AuthenticatedUser");

const UserSummarySchema = z
  .object({
    id: z.number().int().positive(),
    fullname: z.string(),
    email: z.string().email(),
    is_active: z.boolean(),
    created_at: ApiTimestampSchema,
    created_by: z.number().int().positive().nullable(),
  })
  .openapi("UserSummary");

const UserListItemSchema = UserSummarySchema.extend({
  roleNames: z.array(RoleNameSchema),
}).openapi("UserListItem");

const RoleSchema = z
  .object({
    id: z.number().int().positive(),
    name: RoleNameSchema,
    description: z.string().nullable(),
  })
  .openapi("Role");

const PermissionSchema = z
  .object({
    id: z.number().int().positive(),
    action: PermissionActionSchema,
    resource: PermissionResourceSchema,
    description: z.string().nullable(),
  })
  .openapi("Permission");

const PostSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string(),
    content: z.string().nullable(),
    owner_id: z.number().int().positive(),
    owner_fullname: z.string(),
    created_at: ApiTimestampSchema,
    behalf_of: z.number().int().positive().nullable(),
  })
  .openapi("Post");

const AuditLogSchema = z
  .object({
    id: z.number().int().positive(),
    actor_id: z.number().int().positive().nullable(),
    actor_fullname: z.string().nullable(),
    action_type: PermissionActionSchema,
    resource_type: PermissionResourceSchema,
    resource_id: z.number().int().positive(),
    old_values: z.record(z.string(), z.unknown()).nullable(),
    new_values: z.record(z.string(), z.unknown()).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    created_at: ApiTimestampSchema,
  })
  .openapi("AuditLog");

const MigrationSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    run_on: ApiTimestampSchema,
  })
  .openapi("Migration");

const SessionSchema = z
  .object({
    id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    user_fullname: z.string(),
    expires_at: ApiTimestampSchema,
    revoked_at: ApiTimestampSchema.nullable(),
    device_info: z.string().nullable(),
    is_active: z.boolean(),
    created_at: ApiTimestampSchema,
  })
  .openapi("Session");

const UserRoleAssignmentSchema = z
  .object({
    id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    role: RoleSchema,
  })
  .openapi("UserRoleAssignment");

const RolePermissionAssignmentSchema = z
  .object({
    id: z.number().int().positive(),
    role: RoleSchema,
    permission: PermissionSchema,
  })
  .openapi("RolePermissionAssignment");

const PaginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .openapi("PaginationMeta");

const makeSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(
  refId: string,
  dataSchema: T,
) =>
  z
    .object({
      success: z.literal(true),
      message: z.string(),
      data: dataSchema,
      timestamp: ApiTimestampSchema,
    })
    .openapi(refId);

const makeMessageEnvelopeSchema = (refId: string) =>
  z
    .object({
      success: z.literal(true),
      message: z.string(),
      timestamp: ApiTimestampSchema,
    })
    .openapi(refId);

const AuthLoginRequestSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().nonempty().min(4),
  })
  .openapi("AuthLoginRequest");

const AuthRegisterRequestSchema = z
  .object({
    fullname: z.string().trim().min(3).max(150),
    email: z.string().trim().email(),
    password: z.string().nonempty().min(4),
  })
  .openapi("AuthRegisterRequest");

const CreateUserRequestSchema = AuthRegisterRequestSchema.extend({
  roleName: RoleNameSchema.default("user"),
}).openapi("CreateUserRequest");

const UpdateUserRequestSchema = z
  .object({
    fullname: z.string().trim().min(3).max(150).optional(),
    email: z.string().trim().email().optional(),
    oldPassword: z.string().min(4).optional(),
    newPassword: z.string().min(4).optional(),
  })
  .refine(
    (value) =>
      value.fullname !== undefined ||
      value.email !== undefined ||
      value.newPassword !== undefined,
    {
      message: "At least one field is required to update a user",
    },
  )
  .openapi("UpdateUserRequest");

const CreateRoleRequestSchema = z
  .object({
    name: RoleNameSchema,
    description: z.string().trim().min(1).optional(),
  })
  .openapi("CreateRoleRequest");

const UpdateRoleRequestSchema = z
  .object({
    name: RoleNameSchema.optional(),
    description: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.description !== undefined,
    {
      message: "At least one field is required to update a role",
    },
  )
  .openapi("UpdateRoleRequest");

const CreatePermissionRequestSchema = z
  .object({
    action: PermissionActionSchema,
    resource: PermissionResourceSchema,
    description: z.string().trim().optional(),
  })
  .openapi("CreatePermissionRequest");

const UserRoleMutationRequestSchema = z
  .object({
    roleName: RoleNameSchema,
  })
  .openapi("UserRoleMutationRequest");

const RolePermissionMutationRequestSchema = z
  .object({
    roleName: RoleNameSchema,
    action: PermissionActionSchema,
    resource: PermissionResourceSchema,
  })
  .openapi("RolePermissionMutationRequest");

const PostWriteRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(255),
    content: z.string().trim().nullable().optional(),
  })
  .openapi("PostWriteRequest");

const PaginationQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .positive()
      .default(1)
      .openapi({
        param: {
          name: "page",
          in: "query",
          required: false,
          description: "One-based page number.",
          example: 1,
        },
      }),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .default(20)
      .openapi({
        param: {
          name: "pageSize",
          in: "query",
          required: false,
          description: "Number of records per page. Maximum 100.",
          example: 20,
        },
      }),
  })
  .openapi("PaginationQuery");

const makePositivePathParamSchema = (
  name: string,
  description: string,
  example: number,
) =>
  z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: {
        name,
        in: "path",
        required: true,
        description,
        example,
      },
    });

const UserIdParamsSchema = z
  .object({
    userId: makePositivePathParamSchema("userId", "Target user id.", 1),
  })
  .openapi("UserIdParams");

const PermissionIdParamsSchema = z
  .object({
    permissionId: makePositivePathParamSchema(
      "permissionId",
      "Target permission id.",
      1,
    ),
  })
  .openapi("PermissionIdParams");

const PostIdParamsSchema = z
  .object({
    postId: makePositivePathParamSchema("postId", "Target post id.", 1),
  })
  .openapi("PostIdParams");

const SessionIdParamsSchema = z
  .object({
    sessionId: makePositivePathParamSchema(
      "sessionId",
      "Target session id.",
      1,
    ),
  })
  .openapi("SessionIdParams");

const RoleNameParamsSchema = z
  .object({
    roleName: z.enum(ROLES_LIST).openapi({
      param: {
        name: "roleName",
        in: "path",
        required: true,
        description: "Target role name.",
        example: "editor",
      },
    }),
  })
  .openapi("RoleNameParams");

const AuthLoginResponseSchema = makeSuccessEnvelopeSchema(
  "AuthLoginResponse",
  z.object({
    user: AuthenticatedUserSchema,
  }),
);

const AuthRefreshResponseSchema = makeSuccessEnvelopeSchema(
  "AuthRefreshResponse",
  z.object({
    user: AuthenticatedUserSchema,
  }),
);

const AuthMeResponseSchema = makeSuccessEnvelopeSchema(
  "AuthMeResponse",
  z.object({
    user: AuthenticatedUserSchema,
    roles: z.array(RoleNameSchema),
    capabilities: z.array(CapabilityKeySchema),
  }),
);

const AuthLogoutResponseSchema =
  makeMessageEnvelopeSchema("AuthLogoutResponse");

const AuthRegisterResponseSchema = makeSuccessEnvelopeSchema(
  "AuthRegisterResponse",
  z.object({
    user: UserSummarySchema,
    roles: z.array(RoleNameSchema),
  }),
);

const ListUsersResponseSchema = makeSuccessEnvelopeSchema(
  "ListUsersResponse",
  z.object({
    users: z.array(UserListItemSchema),
    pagination: PaginationMetaSchema,
  }),
);

const UserResponseSchema = makeSuccessEnvelopeSchema(
  "UserResponse",
  z.object({
    user: UserSummarySchema,
  }),
);

const CreateUserResponseSchema = makeSuccessEnvelopeSchema(
  "CreateUserResponse",
  z.object({
    user: UserSummarySchema,
    role: RoleSchema,
  }),
);

const ListRolesResponseSchema = makeSuccessEnvelopeSchema(
  "ListRolesResponse",
  z.object({
    roles: z.array(RoleSchema),
    pagination: PaginationMetaSchema,
  }),
);

const RoleResponseSchema = makeSuccessEnvelopeSchema(
  "RoleResponse",
  z.object({
    role: RoleSchema,
  }),
);

const ListPermissionsResponseSchema = makeSuccessEnvelopeSchema(
  "ListPermissionsResponse",
  z.object({
    permissions: z.array(PermissionSchema),
    pagination: PaginationMetaSchema,
  }),
);

const PermissionResponseSchema = makeSuccessEnvelopeSchema(
  "PermissionResponse",
  z.object({
    permission: PermissionSchema,
  }),
);

const UserRoleAssignmentResponseSchema = makeSuccessEnvelopeSchema(
  "UserRoleAssignmentResponse",
  z.object({
    assignment: UserRoleAssignmentSchema,
  }),
);

const ListRolePermissionsResponseSchema = makeSuccessEnvelopeSchema(
  "ListRolePermissionsResponse",
  z.object({
    assignments: z.array(RolePermissionAssignmentSchema),
    pagination: PaginationMetaSchema,
  }),
);

const RolePermissionAssignmentResponseSchema = makeSuccessEnvelopeSchema(
  "RolePermissionAssignmentResponse",
  z.object({
    assignment: RolePermissionAssignmentSchema,
  }),
);

const ListPostsResponseSchema = makeSuccessEnvelopeSchema(
  "ListPostsResponse",
  z.object({
    posts: z.array(PostSchema),
    pagination: PaginationMetaSchema,
  }),
);

const PostResponseSchema = makeSuccessEnvelopeSchema(
  "PostResponse",
  z.object({
    post: PostSchema,
  }),
);

const ListAuditLogsResponseSchema = makeSuccessEnvelopeSchema(
  "ListAuditLogsResponse",
  z.object({
    auditLogs: z.array(AuditLogSchema),
    pagination: PaginationMetaSchema,
  }),
);

const ListMigrationsResponseSchema = makeSuccessEnvelopeSchema(
  "ListMigrationsResponse",
  z.object({
    migrations: z.array(MigrationSchema),
    pagination: PaginationMetaSchema,
  }),
);

const ListSessionsResponseSchema = makeSuccessEnvelopeSchema(
  "ListSessionsResponse",
  z.object({
    sessions: z.array(SessionSchema),
    pagination: PaginationMetaSchema,
  }),
);

const SessionRevokeResponseSchema = makeSuccessEnvelopeSchema(
  "SessionRevokeResponse",
  z.object({
    session: SessionSchema,
  }),
);

const SessionRevokeAllResponseSchema = makeSuccessEnvelopeSchema(
  "SessionRevokeAllResponse",
  z.object({
    revokedCount: z.number().int().nonnegative(),
  }),
);

export {
  ApiErrorSchema,
  AuthenticatedUserSchema,
  UserSummarySchema,
  UserListItemSchema,
  RoleSchema,
  PermissionSchema,
  PostSchema,
  AuditLogSchema,
  MigrationSchema,
  SessionSchema,
  UserRoleAssignmentSchema,
  RolePermissionAssignmentSchema,
  CapabilityKeySchema,
  PaginationMetaSchema,
  AuthLoginRequestSchema,
  AuthRegisterRequestSchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  CreateRoleRequestSchema,
  UpdateRoleRequestSchema,
  CreatePermissionRequestSchema,
  UserRoleMutationRequestSchema,
  RolePermissionMutationRequestSchema,
  PostWriteRequestSchema,
  PaginationQuerySchema,
  UserIdParamsSchema,
  PermissionIdParamsSchema,
  PostIdParamsSchema,
  SessionIdParamsSchema,
  RoleNameParamsSchema,
  AuthLoginResponseSchema,
  AuthRefreshResponseSchema,
  AuthMeResponseSchema,
  AuthLogoutResponseSchema,
  AuthRegisterResponseSchema,
  ListUsersResponseSchema,
  UserResponseSchema,
  CreateUserResponseSchema,
  ListRolesResponseSchema,
  RoleResponseSchema,
  ListPermissionsResponseSchema,
  PermissionResponseSchema,
  UserRoleAssignmentResponseSchema,
  ListRolePermissionsResponseSchema,
  RolePermissionAssignmentResponseSchema,
  ListPostsResponseSchema,
  PostResponseSchema,
  ListAuditLogsResponseSchema,
  ListMigrationsResponseSchema,
  ListSessionsResponseSchema,
  SessionRevokeResponseSchema,
  SessionRevokeAllResponseSchema,
};
