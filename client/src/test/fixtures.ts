import type {
  AuthMeData,
  AuthenticatedUser,
  CapabilityKey,
  PaginationMeta,
  Permission,
  Post,
  Role,
  RoleName,
  RolePermissionAssignment,
  UserListItem,
} from '@/api/types'

let nextId = 1

export function resetMockIds() {
  nextId = 1
}

export function createPaginationMeta(
  total: number,
  page = 1,
  pageSize = 20,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  }
}

export function createMockUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  const id = nextId++

  return {
    id,
    fullname: `User ${id}`,
    email: `user${id}@test.com`,
    ...overrides,
  }
}

export function createMockAuthMe(
  overrides: Partial<AuthMeData> = {},
): AuthMeData {
  return {
    user: createMockUser({
      fullname: 'Test Admin',
      email: 'admin@test.com',
    }),
    roles: ['super-admin'],
    capabilities: [
      'users.view',
      'users.create',
      'users.update',
      'users.delete',
      'users.assignRole',
      'users.revokeRole',
      'roles.view',
      'roles.create',
      'roles.update',
      'roles.delete',
      'permissions.view',
      'permissions.create',
      'permissions.delete',
      'rolePermissions.view',
      'rolePermissions.assign',
      'rolePermissions.revoke',
      'posts.view',
      'posts.create',
      'posts.update',
      'posts.delete',
      'posts.createOnBehalf',
      'auditLogs.view',
      'migrations.view',
      'sessions.view',
      'sessions.revoke',
      'sessions.delete',
    ],
    ...overrides,
  }
}

export function createMockUserListItem(
  overrides: Partial<UserListItem> = {},
): UserListItem {
  const id = nextId++

  return {
    id,
    fullname: `User ${id}`,
    email: `user${id}@test.com`,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
    roleNames: ['user'],
    ...overrides,
  }
}

export function createMockRole(overrides: Partial<Role> = {}): Role {
  const id = nextId++

  return {
    id,
    name: 'user',
    description: 'Default user role',
    ...overrides,
  }
}

export function createMockPermission(
  overrides: Partial<Permission> = {},
): Permission {
  const id = nextId++

  return {
    id,
    action: 'view',
    resource: 'post',
    description: null,
    ...overrides,
  }
}

export function createMockRolePermissionAssignment(
  overrides: Partial<RolePermissionAssignment> & {
    roleName?: RoleName
  } = {},
): RolePermissionAssignment {
  const { roleName, ...assignmentOverrides } = overrides

  return {
    id: nextId++,
    role: createMockRole({ name: roleName ?? 'user' }),
    permission: createMockPermission(),
    ...assignmentOverrides,
  }
}

export function createMockPost(overrides: Partial<Post> = {}): Post {
  const id = nextId++

  return {
    id,
    title: `Test Post ${id}`,
    content: 'Test content',
    owner_id: 1,
    owner_fullname: 'Test User',
    created_at: '2026-01-01T00:00:00.000Z',
    behalf_of: null,
    ...overrides,
  }
}

export function capabilities(...items: CapabilityKey[]) {
  return items
}
