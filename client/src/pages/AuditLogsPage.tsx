import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { auditLogsApi } from '@/api/services'
import { AccessDenied } from '@/components/shared'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { AuditLogsPanel } from '@/features/audit-logs'
import { useCapabilities } from '@/hooks/useAuth'

export function AuditLogsPage() {
  const { can } = useCapabilities()
  const [page, setPage] = useState(1)
  const [fetchEnabled, setFetchEnabled] = useState(false)
  const auditLogs = useQuery({
    queryKey: queryKeys.auditLogs(page),
    queryFn: () => auditLogsApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: fetchEnabled,
  })

  if (!can('auditLogs.view')) {
    return <AccessDenied />
  }

  const hasCachedData = !!auditLogs.data

  return (
    <div className="page-stack">
      <AuditLogsPanel
        fetchEnabled={fetchEnabled}
        hasCachedData={hasCachedData}
        auditLogs={auditLogs.data?.auditLogs}
        pagination={auditLogs.data?.pagination}
        isLoading={auditLogs.isLoading}
        isError={auditLogs.isError}
        error={auditLogs.error}
        isFetching={auditLogs.isFetching}
        onFetch={() => {
          setFetchEnabled(true)
          if (fetchEnabled || hasCachedData) void auditLogs.refetch()
        }}
        onRetry={() => void auditLogs.refetch()}
        onPageChange={setPage}
      />
    </div>
  )
}
