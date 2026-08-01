import type { GroupedRolePermission } from '@/api/types'
import { QueryErrorState } from '@/components/QueryErrorState'
import { Badge, EmptyState, SkeletonRows } from '@/components/ui'

type RolePermissionsAssignmentsTableProps = {
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  groupedAssignments: GroupedRolePermission[]
  onRetry: () => void
}

export function RolePermissionsAssignmentsTable({
  isLoading,
  isError,
  error,
  isFetching,
  groupedAssignments,
  onRetry,
}: RolePermissionsAssignmentsTableProps) {
  if (isLoading) {
    return <SkeletonRows />
  }

  if (isError) {
    return (
      <QueryErrorState
        title="Unable to load role-permission assignments"
        error={error}
        onRetry={onRetry}
        isRetrying={isFetching}
      />
    )
  }

  if (groupedAssignments.length) {
    return (
      <div className="table-wrap">
        <table className="table-narrow">
          <thead>
            <tr>
              <th>Action</th>
              <th>Resource</th>
              <th>Roles</th>
            </tr>
          </thead>
          <tbody>
            {groupedAssignments.map((assignment) => (
              <tr key={assignment.key}>
                <td>
                  <Badge>{assignment.action}</Badge>
                </td>
                <td>{assignment.resource}</td>
                <td>
                  <div className="badge-list">
                    {assignment.roles.map((nextRoleName) => (
                      <Badge key={nextRoleName}>{nextRoleName}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!isLoading) {
    return <EmptyState>No assignments returned.</EmptyState>
  }

  return null
}
