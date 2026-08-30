import type { Session } from '@/api/types'
import { PaginationControls } from '@/components/PaginationControls'
import { AsyncQueryPanel } from '@/components/shared'
import { SessionsTable } from './SessionsTable'

type SessionsQueryResultProps = {
  sessions?: Session[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  emptyLabel: string
  errorTitle: string
  onRetry: () => void
  onPageChange: (page: number) => void
}

export function SessionsQueryResult({
  sessions,
  pagination,
  isLoading,
  isError,
  error,
  isFetching,
  emptyLabel,
  errorTitle,
  onRetry,
  onPageChange,
}: SessionsQueryResultProps) {
  const hasData = Boolean(sessions?.length && pagination)

  return (
    <AsyncQueryPanel
      isLoading={isLoading}
      isError={isError}
      error={error}
      isFetching={isFetching}
      hasData={hasData}
      emptyLabel={emptyLabel}
      errorTitle={errorTitle}
      onRetry={onRetry}
    >
      {hasData && sessions && pagination ? (
        <div className="table-wrap">
          <SessionsTable sessions={sessions} />
          <PaginationControls pagination={pagination} onPageChange={onPageChange} />
        </div>
      ) : null}
    </AsyncQueryPanel>
  )
}
