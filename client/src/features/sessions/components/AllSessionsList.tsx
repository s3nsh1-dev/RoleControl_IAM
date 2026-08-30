import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { sessionsApi } from '@/api/services'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { SessionsQueryResult } from './SessionsQueryResult'

export function AllSessionsList() {
  const [page, setPage] = useState(1)
  const sessions = useQuery({
    queryKey: queryKeys.sessions(page),
    queryFn: () => sessionsApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  return (
    <SessionsQueryResult
      sessions={sessions.data?.sessions}
      pagination={sessions.data?.pagination}
      isLoading={sessions.isLoading}
      isError={sessions.isError}
      error={sessions.error}
      isFetching={sessions.isFetching}
      emptyLabel="No sessions returned."
      errorTitle="Unable to load sessions"
      onRetry={() => void sessions.refetch()}
      onPageChange={setPage}
    />
  )
}
