import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { migrationsApi } from '@/api/services'
import { Panel } from '@/components/ui'
import { AccessDenied } from '@/components/shared'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { MigrationsTable } from '@/features/migrations'
import { useCapabilities } from '@/hooks/useAuth'

export function MigrationsPage() {
  const { can } = useCapabilities()
  const [page, setPage] = useState(1)
  const migrations = useQuery({
    queryKey: queryKeys.migrations(page),
    queryFn: () => migrationsApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  if (!can('migrations.view')) {
    return <AccessDenied />
  }

  return (
    <div className="page-stack">
      <Panel title="Migrations" description="Database migration history.">
        <MigrationsTable
          migrations={migrations.data?.migrations}
          pagination={migrations.data?.pagination}
          isLoading={migrations.isLoading}
          isError={migrations.isError}
          error={migrations.error}
          isFetching={migrations.isFetching}
          onPageChange={setPage}
          onRetry={() => void migrations.refetch()}
        />
      </Panel>
    </div>
  )
}
