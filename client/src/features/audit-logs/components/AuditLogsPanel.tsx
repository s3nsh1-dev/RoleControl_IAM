import type { AuditLog, PaginationMeta } from '@/api/types'
import { PaginationControls } from '@/components/PaginationControls'
import { QueryErrorState } from '@/components/QueryErrorState'
import { Button, EmptyState, Panel, SkeletonRows } from '@/components/ui'
import { AuditLogsTable } from './AuditLogsTable'

type AuditLogsPanelProps = {
  fetchEnabled: boolean
  hasCachedData: boolean
  auditLogs?: AuditLog[]
  pagination?: PaginationMeta
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  onFetch: () => void
  onRetry: () => void
  onPageChange: (page: number) => void
}

export function AuditLogsPanel({
  fetchEnabled,
  hasCachedData,
  auditLogs,
  pagination,
  isLoading,
  isError,
  error,
  isFetching,
  onFetch,
  onRetry,
  onPageChange,
}: AuditLogsPanelProps) {
  return (
    <Panel
      title="Audit Logs"
      description="User action history."
      actions={
        <Button
          type="button"
          variant="primary"
          disabled={isFetching}
          onClick={onFetch}
        >
          {hasCachedData ? 're-Fetch' : 'Fetch logs'}
        </Button>
      }
    >
      {!fetchEnabled && !hasCachedData ? (
        <EmptyState>Logs have not been fetched.</EmptyState>
      ) : null}
      {(fetchEnabled || hasCachedData) && isLoading ? <SkeletonRows /> : null}
      {(fetchEnabled || hasCachedData) && isError ? (
        <QueryErrorState
          title="Unable to load audit logs"
          error={error}
          onRetry={onRetry}
          isRetrying={isFetching}
        />
      ) : auditLogs?.length ? (
        <AuditLogsTable auditLogs={auditLogs} />
      ) : (fetchEnabled || hasCachedData) && !isLoading ? (
        <EmptyState>No audit logs returned.</EmptyState>
      ) : null}
      {pagination ? (
        <PaginationControls pagination={pagination} onPageChange={onPageChange} />
      ) : null}
    </Panel>
  )
}
