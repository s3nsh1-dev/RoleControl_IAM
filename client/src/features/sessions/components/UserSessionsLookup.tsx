import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { sessionsApi } from '@/api/services'
import { Button, EmptyState, Field } from '@/components/ui'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { userIdSchema, type UserIdFormValues } from '@/validation/schemas'
import { SessionsQueryResult } from './SessionsQueryResult'

export function UserSessionsLookup() {
  const [page, setPage] = useState(1)
  const [userId, setUserId] = useState<number | null>(null)
  const form = useForm<UserIdFormValues>({
    resolver: zodResolver(userIdSchema),
    defaultValues: { userId: '' },
    mode: 'onBlur',
  })
  const sessions = useQuery({
    queryKey: userId
      ? queryKeys.userSessions(userId, page)
      : (['user-sessions', 'idle', { page }] as const),
    queryFn: () =>
      sessionsApi.listByUser(userId ?? 0, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    enabled: userId !== null,
  })

  return (
    <div className="page-stack flush">
      <form
        className="form-grid compact"
        onSubmit={form.handleSubmit((data) => {
          setPage(1)
          setUserId(Number(data.userId))
        })}
      >
        <Field
          label="User ID"
          type="number"
          min={1}
          error={form.formState.errors.userId?.message}
          {...form.register('userId')}
        />
        <Button type="submit" variant="primary" disabled={sessions.isFetching}>
          Fetch
        </Button>
      </form>

      {userId === null ? (
        <EmptyState>Enter a user ID to fetch sessions.</EmptyState>
      ) : (
        <SessionsQueryResult
          sessions={sessions.data?.sessions}
          pagination={sessions.data?.pagination}
          isLoading={sessions.isLoading}
          isError={sessions.isError}
          error={sessions.error}
          isFetching={sessions.isFetching}
          emptyLabel="No sessions returned for this user."
          errorTitle="Unable to load user sessions"
          onRetry={() => void sessions.refetch()}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
