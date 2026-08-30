import { useQuery } from '@tanstack/react-query'
import { permissionsApi, postsApi, rolesApi, usersApi } from '@/api/services'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { DashboardStatsGrid, OperationalNotesPanel } from '@/features/dashboard'

export function DashboardPage() {
  const query = { page: 1, pageSize: DEFAULT_PAGE_SIZE }
  const users = useQuery({
    queryKey: queryKeys.users(1),
    queryFn: () => usersApi.list(query),
  })
  const roles = useQuery({
    queryKey: queryKeys.roles(1),
    queryFn: () => rolesApi.list(query),
  })
  const permissions = useQuery({
    queryKey: queryKeys.permissions(1),
    queryFn: () => permissionsApi.list(query),
  })
  const posts = useQuery({
    queryKey: queryKeys.posts(1),
    queryFn: () => postsApi.list(query),
  })

  const stats = [
    { label: 'Users', value: users.data?.pagination.total },
    { label: 'Roles', value: roles.data?.pagination.total },
    { label: 'Permissions', value: permissions.data?.pagination.total },
    { label: 'Posts', value: posts.data?.pagination.total },
  ]
  const failedQueries = [users, roles, permissions, posts].filter(
    (queryResult) => queryResult.isError,
  )

  return (
    <div className="page-stack">
      <DashboardStatsGrid stats={stats} failedQueries={failedQueries} />
      <OperationalNotesPanel />
    </div>
  )
}
