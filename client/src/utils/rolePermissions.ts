import type {
  GroupedRolePermission,
  RoleName,
  RolePermissionAssignment,
} from '../api/types'
import { roleNames } from '../api/types'

const roleOrder = new Map<RoleName, number>(
  roleNames.map((roleName, index) => [roleName, index]),
)

export function groupRolePermissionAssignments(
  assignments: RolePermissionAssignment[],
): GroupedRolePermission[] {
  const grouped = new Map<string, GroupedRolePermission>()

  for (const assignment of assignments) {
    const action = assignment.permission.action
    const resource = assignment.permission.resource
    const key = `${action}:${resource}`
    const existing = grouped.get(key)

    if (existing) {
      if (!existing.roles.includes(assignment.role.name)) {
        existing.roles.push(assignment.role.name)
      }
      continue
    }

    grouped.set(key, {
      key,
      action,
      resource,
      roles: [assignment.role.name],
    })
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      roles: [...group.roles].sort(
        (left, right) =>
          (roleOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (roleOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
      ),
    }))
    .sort((left, right) => {
      const resourceOrder = left.resource.localeCompare(right.resource)
      if (resourceOrder !== 0) return resourceOrder

      return left.action.localeCompare(right.action)
    })
}
