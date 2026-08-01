import type { PaginationMeta, Permission } from '@/api/types'
import { PaginationControls } from '@/components/PaginationControls'
import { AsyncQueryPanel } from '@/components/shared'
import { Badge, Button } from '@/components/ui'
import type { useConfirmAction } from '@/hooks/useConfirmAction'

type PermissionsTableProps = {
  permissions?: Permission[]
  pagination?: PaginationMeta
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  canDelete: boolean
  onPageChange: (page: number) => void
  onRetry: () => void
  onDelete: (permissionId: number) => void
  confirm: ReturnType<typeof useConfirmAction>['confirm']
}

export function PermissionsTable({
  permissions,
  pagination,
  isLoading,
  isError,
  error,
  isFetching,
  canDelete,
  onPageChange,
  onRetry,
  onDelete,
  confirm,
}: PermissionsTableProps) {
  const hasData = Boolean(permissions?.length && pagination)

  return (
    <AsyncQueryPanel
      isLoading={isLoading}
      isError={isError}
      error={error}
      isFetching={isFetching}
      hasData={hasData}
      emptyLabel="No permissions returned."
      errorTitle="Unable to load permissions"
      onRetry={onRetry}
    >
      {hasData && permissions && pagination ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Description</th>
                {canDelete ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.id}>
                  <td>{permission.id}</td>
                  <td>
                    <Badge>{permission.action}</Badge>
                  </td>
                  <td>{permission.resource}</td>
                  <td>{permission.description ?? 'No description'}</td>
                  {canDelete ? (
                    <td>
                      <Button
                        variant="danger"
                        onClick={() =>
                          confirm({
                            title: 'Delete permission',
                            description: `Delete ${permission.action}:${permission.resource}?`,
                            confirmLabel: 'Delete',
                            onConfirm: () => onDelete(permission.id),
                          })
                        }
                      >
                        Delete
                      </Button>
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
