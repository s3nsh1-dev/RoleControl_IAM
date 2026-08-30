import type { ReactNode } from 'react'
import { QueryErrorState } from '@/components/QueryErrorState'
import { EmptyState, SkeletonRows } from '@/components/ui'

type AsyncQueryPanelProps = {
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  hasData: boolean
  emptyLabel: string
  errorTitle: string
  onRetry: () => void
  children: ReactNode
}

export function AsyncQueryPanel({
  isLoading,
  isError,
  error,
  isFetching,
  hasData,
  emptyLabel,
  errorTitle,
  onRetry,
  children,
}: AsyncQueryPanelProps) {
  if (isLoading) {
    return <SkeletonRows />
  }

  if (isError && error) {
    return (
      <QueryErrorState
        title={errorTitle}
        error={error}
        onRetry={onRetry}
        isRetrying={isFetching}
      />
    )
  }

  if (hasData) {
    return children
  }

  return <EmptyState>{emptyLabel}</EmptyState>
}
