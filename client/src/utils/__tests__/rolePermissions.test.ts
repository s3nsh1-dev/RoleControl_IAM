import { describe, expect, it } from 'vitest'
import { createMockPermission, createMockRolePermissionAssignment } from '@/test/fixtures'
import { groupRolePermissionAssignments } from '../rolePermissions'

describe('groupRolePermissionAssignments', () => {
  it('returns an empty array for empty input', () => {
    expect(groupRolePermissionAssignments([])).toEqual([])
  })

  it('groups assignments by action and resource', () => {
    const permission = createMockPermission({ action: 'view', resource: 'post' })
    const result = groupRolePermissionAssignments([
      createMockRolePermissionAssignment({ roleName: 'admin', permission }),
      createMockRolePermissionAssignment({ roleName: 'editor', permission }),
    ])

    expect(result).toEqual([
      {
        key: 'view:post',
        action: 'view',
        resource: 'post',
        roles: ['admin', 'editor'],
      },
    ])
  })

  it('deduplicates roles within a group', () => {
    const permission = createMockPermission({ action: 'update', resource: 'post' })
    const result = groupRolePermissionAssignments([
      createMockRolePermissionAssignment({ roleName: 'editor', permission }),
      createMockRolePermissionAssignment({ roleName: 'editor', permission }),
    ])

    expect(result[0]?.roles).toEqual(['editor'])
  })

  it('sorts roles by role priority and groups by resource then action', () => {
    const result = groupRolePermissionAssignments([
      createMockRolePermissionAssignment({
        roleName: 'user',
        permission: createMockPermission({ action: 'delete', resource: 'post' }),
      }),
      createMockRolePermissionAssignment({
        roleName: 'super-admin',
        permission: createMockPermission({ action: 'delete', resource: 'post' }),
      }),
      createMockRolePermissionAssignment({
        roleName: 'admin',
        permission: createMockPermission({ action: 'view', resource: 'audit_log' }),
      }),
      createMockRolePermissionAssignment({
        roleName: 'editor',
        permission: createMockPermission({ action: 'create', resource: 'post' }),
      }),
    ])

    expect(result.map((group) => group.key)).toEqual([
      'view:audit_log',
      'create:post',
      'delete:post',
    ])
    expect(result.find((group) => group.key === 'delete:post')?.roles).toEqual([
      'super-admin',
      'user',
    ])
  })
})
