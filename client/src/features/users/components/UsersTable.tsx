import type { PaginationMeta, UserListItem } from '@/api/types'
import { PaginationControls } from '@/components/PaginationControls'
import { AsyncQueryPanel } from '@/components/shared'
import { Badge, Button } from '@/components/ui'
import type { useConfirmAction } from '@/hooks/useConfirmAction'
import { formatDate } from '@/utils/format'

type UsersTableProps = {
  users?: UserListItem[]
  pagination?: PaginationMeta
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  canUpdate: boolean
  canDelete: boolean
  onPageChange: (page: number) => void
  onRetry: () => void
  onEdit: (user: UserListItem) => void
  onDelete: (user: UserListItem) => void
  confirm: ReturnType<typeof useConfirmAction>['confirm']
}

export function UsersTable({
  users,
  pagination,
  isLoading,
  isError,
  error,
  isFetching,
  canUpdate,
  canDelete,
  onPageChange,
  onRetry,
  onEdit,
  onDelete,
  confirm,
}: UsersTableProps) {
  const hasData = Boolean(users?.length && pagination)
  const showActions = canUpdate || canDelete

  return (
    <AsyncQueryPanel
      isLoading={isLoading}
      isError={isError}
      error={error}
      isFetching={isFetching}
      hasData={hasData}
      emptyLabel="No users returned."
      errorTitle="Unable to load users"
      onRetry={onRetry}
    >
      {hasData && users && pagination ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Created</th>
                {showActions ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.fullname}</td>
                  <td>{user.email}</td>
                  <td>
                    <div className="badge-list">
                      {user.roleNames.length ? (
                        user.roleNames.map((roleName) => (
                          <Badge key={roleName}>{roleName}</Badge>
                        ))
                      ) : (
                        <span className="muted">No roles</span>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  {showActions ? (
                    <td>
                      <div className="button-row">
                        {canUpdate ? (
                          <Button onClick={() => onEdit(user)}>Edit</Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="danger"
                            onClick={() =>
                              confirm({
                                title: 'Delete user',
                                description: `Delete ${user.email}?`,
                                confirmLabel: 'Delete',
                                onConfirm: () => onDelete(user),
                              })
                            }
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls pagination={pagination} onPageChange={onPageChange} />
        </div>
      ) : null}
    </AsyncQueryPanel>
  )
}
