import type { PaginationMeta, Role } from '@/api/types'
import { PaginationControls } from '@/components/PaginationControls'
import { AsyncQueryPanel } from '@/components/shared'
import { RoleCard } from './RoleCard'

type RolesListProps = {
  roles?: Role[]
  pagination?: PaginationMeta
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  canUpdate: boolean
  canDelete: boolean
  onPageChange: (page: number) => void
  onRetry: () => void
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
}

export function RolesList({
  roles,
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
}: RolesListProps) {
  const hasData = Boolean(roles?.length)

  return (
    <>
      <AsyncQueryPanel
        isLoading={isLoading}
        isError={isError}
        error={error}
        isFetching={isFetching}
        hasData={hasData}
        emptyLabel="No roles returned."
        errorTitle="Unable to load roles"
        onRetry={onRetry}
      >
        {hasData && roles ? (
          <div className="record-grid">
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onEdit={() => onEdit(role)}
                onDelete={() => onDelete(role)}
              />
            ))}
          </div>
        ) : null}
      </AsyncQueryPanel>
      <PaginationControls pagination={pagination} onPageChange={onPageChange} />
    </>
  )
}
