import type { UseQueryResult } from '@tanstack/react-query'
import { QueryErrorState } from '@/components/QueryErrorState'

type StatItem = {
  label: string
  value: number | undefined
}

type DashboardStatsGridProps = {
  stats: StatItem[]
  failedQueries: UseQueryResult<unknown, Error>[]
}

export function DashboardStatsGrid({
  stats,
  failedQueries,
}: DashboardStatsGridProps) {
  if (failedQueries.length) {
    return (
      <QueryErrorState
        title="Unable to load dashboard"
        error={failedQueries[0].error}
        onRetry={() => {
          failedQueries.forEach((queryResult) => {
            void queryResult.refetch()
          })
        }}
        isRetrying={failedQueries.some((queryResult) => queryResult.isFetching)}
      />
    )
  }

  return (
    <section className="stats-grid">
      {stats.map((stat) => (
        <div className="stat-card" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value ?? '-'}</strong>
        </div>
      ))}
    </section>
  )
}
