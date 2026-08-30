import type { components } from './schema'

type Schemas = components['schemas']

export type ApiErrorBody = Schemas['ApiError']
export type AuthenticatedUser = Schemas['AuthenticatedUser']
export type UserSummary = Schemas['UserSummary']
export type UserListItem = Schemas['UserListItem']
export type Role = Schemas['Role']
export type RoleName = Schemas['RoleName']
export type Permission = Schemas['Permission']
export type PermissionAction = Schemas['PermissionAction']
export type PermissionResource = Schemas['PermissionResource']
export type CapabilityKey = Schemas['CapabilityKey']
export type PaginationMeta = Schemas['PaginationMeta']
export type UserRoleAssignment = Schemas['UserRoleAssignment']
export type RolePermissionAssignment = Schemas['RolePermissionAssignment']
export type Post = Schemas['Post']
export type AuditLog = Schemas['AuditLog']
export type Migration = Schemas['Migration']
export type Session = Schemas['Session']

export type GroupedRolePermission = {
  key: string
  action: PermissionAction
  resource: PermissionResource
  roles: RoleName[]
}

export type AuthLoginRequest = Schemas['AuthLoginRequest']
export type AuthRegisterRequest = Schemas['AuthRegisterRequest']
export type CreateUserRequest = Schemas['CreateUserRequest']
export type UpdateUserRequest = Schemas['UpdateUserRequest']
export type CreateRoleRequest = Schemas['CreateRoleRequest']
export type UpdateRoleRequest = Schemas['UpdateRoleRequest']
export type CreatePermissionRequest = Schemas['CreatePermissionRequest']
export type UserRoleMutationRequest = Schemas['UserRoleMutationRequest']
export type RolePermissionMutationRequest =
  Schemas['RolePermissionMutationRequest']
export type PostWriteRequest = Schemas['PostWriteRequest']

export type AuthMeData = Schemas['AuthMeResponse']['data']
export type PaginationQuery = {
  page: number
  pageSize: number
}

export const roleNames = [
  'super-admin',
  'admin',
  'editor',
  'user',
] as const satisfies readonly RoleName[]

export const permissionActions = [
  'view',
  'create',
  'update',
  'assign',
  'revoke',
  'delete',
  'createOnBehalf',
] as const satisfies readonly PermissionAction[]

export const permissionResources = [
  'permission',
  'role',
  'user',
  'post',
  'audit_log',
  'session',
  'migration',
] as const satisfies readonly PermissionResource[]
