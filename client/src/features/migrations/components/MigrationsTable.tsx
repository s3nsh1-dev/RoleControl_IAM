import type { PaginationMeta } from '@/api/types'
import { PaginationControls } from '@/components/PaginationControls'
import { AsyncQueryPanel } from '@/components/shared'
import { formatDate } from '@/utils/format'

type MigrationRow = {
  id: number
  name: string
  run_on: string
}

type MigrationsTableProps = {
  migrations?: MigrationRow[]
  pagination?: PaginationMeta
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  onPageChange: (page: number) => void
  onRetry: () => void
}

export function MigrationsTable({
  migrations,
  pagination,
  isLoading,
  isError,
  error,
  isFetching,
  onPageChange,
  onRetry,
}: MigrationsTableProps) {
  const hasData = Boolean(migrations?.length && pagination)

  return (
    <AsyncQueryPanel
      isLoading={isLoading}
      isError={isError}
      error={error}
      isFetching={isFetching}
      hasData={hasData}
      emptyLabel="No migrations returned."
      errorTitle="Unable to load migrations"
      onRetry={onRetry}
    >
      {hasData && migrations && pagination ? (
        <div className="table-wrap">
          <table className="table-narrow">
            <thead>
              <tr>
                <th>ID</th>
                <th>Migration Name</th>
                <th>Run On</th>
              </tr>
            </thead>
            <tbody>
              {migrations.map((migration) => (
                <tr key={migration.id}>
                  <td>{migration.id}</td>
                  <td>{migration.name}</td>
                  <td>{formatDate(migration.run_on)}</td>
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
