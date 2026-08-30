import { request } from './client'
import type {
  AuthLoginRequest,
  AuthMeData,
  AuthRegisterRequest,
  AuthenticatedUser,
  AuditLog,
  CreatePermissionRequest,
  CreateRoleRequest,
  CreateUserRequest,
  Migration,
  PaginationMeta,
  PaginationQuery,
  Permission,
  Post,
  PostWriteRequest,
  Role,
  RoleName,
  RolePermissionAssignment,
  RolePermissionMutationRequest,
  Session,
  UpdateRoleRequest,
  UpdateUserRequest,
  UserListItem,
  UserRoleAssignment,
  UserRoleMutationRequest,
  UserSummary,
} from './types'

const paginationParams = ({ page, pageSize }: PaginationQuery) => ({
  params: { page, pageSize },
})

export const authApi = {
  login: (data: AuthLoginRequest) =>
    request<{ user: AuthenticatedUser }>({
      method: 'POST',
      url: '/api/auth/login',
      data,
    }),
  refresh: () =>
    request<{ user: AuthenticatedUser }>({
      method: 'GET',
      url: '/api/auth/refresh',
    }),
  me: () =>
    request<AuthMeData>({
      method: 'GET',
      url: '/api/auth/me',
    }),
  logout: () =>
    request<void>({
      method: 'POST',
      url: '/api/auth/logout',
    }),
  register: (data: AuthRegisterRequest) =>
    request<{ user: UserSummary; roles: RoleName[] }>({
      method: 'POST',
      url: '/api/auth/register',
      data,
    }),
}

export const usersApi = {
  list: (query: PaginationQuery) =>
    request<{ users: UserListItem[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/users',
      ...paginationParams(query),
    }),
  create: (data: CreateUserRequest) =>
    request<{ user: UserSummary; role: Role }>({
      method: 'POST',
      url: '/api/users',
      data,
    }),
  update: (userId: number, data: UpdateUserRequest) =>
    request<{ user: UserSummary }>({
      method: 'PUT',
      url: `/api/users/${userId}`,
      data,
    }),
  remove: (userId: number) =>
    request<{ user: UserSummary }>({
      method: 'DELETE',
      url: `/api/users/${userId}`,
    }),
}

export const rolesApi = {
  list: (query: PaginationQuery) =>
    request<{ roles: Role[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/roles',
      ...paginationParams(query),
    }),
  create: (data: CreateRoleRequest) =>
    request<{ role: Role }>({ method: 'POST', url: '/api/roles', data }),
  update: (roleName: RoleName, data: UpdateRoleRequest) =>
    request<{ role: Role }>({
      method: 'PUT',
      url: `/api/roles/${encodeURIComponent(roleName)}`,
      data,
    }),
  remove: (roleName: RoleName) =>
    request<{ role: Role }>({
      method: 'DELETE',
      url: `/api/roles/${encodeURIComponent(roleName)}`,
    }),
}

export const permissionsApi = {
  list: (query: PaginationQuery) =>
    request<{ permissions: Permission[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/permissions',
      ...paginationParams(query),
    }),
  create: (data: CreatePermissionRequest) =>
    request<{ permission: Permission }>({
      method: 'POST',
      url: '/api/permissions',
      data,
    }),
  remove: (permissionId: number) =>
    request<{ permission: Permission }>({
      method: 'DELETE',
      url: `/api/permissions/${permissionId}`,
    }),
}

export const userRolesApi = {
  assign: (userId: number, data: UserRoleMutationRequest) =>
    request<{ assignment: UserRoleAssignment }>({
      method: 'POST',
      url: `/api/user-roles/${userId}`,
      data,
    }),
  revoke: (userId: number, data: UserRoleMutationRequest) =>
    request<{ assignment: UserRoleAssignment }>({
      method: 'DELETE',
      url: `/api/user-roles/${userId}`,
      data,
    }),
}

export const rolePermissionsApi = {
  list: (query: PaginationQuery) =>
    request<{ assignments: RolePermissionAssignment[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/role-permissions',
      ...paginationParams(query),
    }),
  listAll: async () => {
    const pageSize = 100
    const firstPage = await rolePermissionsApi.list({ page: 1, pageSize })
    const remainingPages = Array.from(
      { length: Math.max(firstPage.pagination.totalPages - 1, 0) },
      (_, index) => index + 2,
    )

    const remainingResults = await Promise.all(
      remainingPages.map((page) => rolePermissionsApi.list({ page, pageSize })),
    )

    return {
      assignments: [
        ...firstPage.assignments,
        ...remainingResults.flatMap((result) => result.assignments),
      ],
    }
  },
  assign: (data: RolePermissionMutationRequest) =>
    request<{ assignment: RolePermissionAssignment }>({
      method: 'POST',
      url: '/api/role-permissions',
      data,
    }),
  revoke: (data: RolePermissionMutationRequest) =>
    request<{ assignment: RolePermissionAssignment }>({
      method: 'DELETE',
      url: '/api/role-permissions',
      data,
    }),
}

export const postsApi = {
  list: (query: PaginationQuery) =>
    request<{ posts: Post[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/posts',
      ...paginationParams(query),
    }),
  create: (data: PostWriteRequest) =>
    request<{ post: Post }>({ method: 'POST', url: '/api/posts', data }),
  createOnBehalf: (userId: number, data: PostWriteRequest) =>
    request<{ post: Post }>({
      method: 'POST',
      url: `/api/posts/on-behalf/${userId}`,
      data,
    }),
  read: (postId: number) =>
    request<{ post: Post }>({ method: 'GET', url: `/api/posts/${postId}` }),
  update: (postId: number, data: PostWriteRequest) =>
    request<{ post: Post }>({
      method: 'PUT',
      url: `/api/posts/${postId}`,
      data,
    }),
  remove: (postId: number) =>
    request<{ post: Post }>({
      method: 'DELETE',
      url: `/api/posts/${postId}`,
    }),
}

export const auditLogsApi = {
  list: (query: PaginationQuery) =>
    request<{ auditLogs: AuditLog[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/audit-logs',
      ...paginationParams(query),
    }),
}

export const migrationsApi = {
  list: (query: PaginationQuery) =>
    request<{ migrations: Migration[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/system/migrations',
      ...paginationParams(query),
    }),
}

export const sessionsApi = {
  list: (query: PaginationQuery) =>
    request<{ sessions: Session[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: '/api/sessions',
      ...paginationParams(query),
    }),
  listByUser: (userId: number, query: PaginationQuery) =>
    request<{ sessions: Session[]; pagination: PaginationMeta }>({
      method: 'GET',
      url: `/api/users/${userId}/sessions`,
      ...paginationParams(query),
    }),
  revoke: (sessionId: number) =>
    request<{ session: Session }>({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/revoke`,
    }),
  revokeAllByUser: (userId: number) =>
    request<{ revokedCount: number }>({
      method: 'PUT',
      url: `/api/users/${userId}/sessions/revoke-all`,
    }),
}
