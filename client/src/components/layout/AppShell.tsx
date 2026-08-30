import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { authApi } from '@/api/services'
import { navItems, type NavItem } from '@/constants'
import { useAuthMe } from '@/hooks/useAuth'
import { AuditLogsPage } from '@/pages/AuditLogsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { MigrationsPage } from '@/pages/MigrationsPage'
import { PermissionsPage } from '@/pages/PermissionsPage'
import { PostsPage } from '@/pages/PostsPage'
import { RolePermissionsPage } from '@/pages/RolePermissionsPage'
import { RolesPage } from '@/pages/RolesPage'
import {
  AllSessionsPage,
  RevokeAllSessionsPage,
  RevokeSessionPage,
  SessionsPage,
  UserSessionsPage,
} from '@/pages/SessionsPage'
import { UsersPage } from '@/pages/UsersPage'
import { useAuthStore } from '@/store/auth'
import { AppSidebar } from './AppSidebar'
import { AppTopbar } from './AppTopbar'
import { visibleNavItem } from './navVisibility'

export function AppShell() {
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { data: access, isLoading } = useAuthMe()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>(
    () => ({ Sessions: location.pathname.startsWith('/sessions') }),
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const visibleNavItems = navItems
    .map((item) => visibleNavItem(item, access?.capabilities))
    .filter((item): item is NavItem => Boolean(item))

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen)

    return () => document.body.classList.remove('sidebar-open')
  }, [sidebarOpen])

  return (
    <div className="app-shell">
      <AppSidebar
        visibleNavItems={visibleNavItems}
        openNavGroups={openNavGroups}
        onToggleNavGroup={(label) =>
          setOpenNavGroups((current) => ({
            ...current,
            [label]: !current[label],
          }))
        }
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      <main className="main">
        <AppTopbar
          access={access}
          isLoading={isLoading}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          logoutPending={logoutMutation.isPending}
          onLogout={() => logoutMutation.mutate()}
        />

        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/permissions" element={<PermissionsPage />} />
          <Route path="/role-permissions" element={<RolePermissionsPage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/logs" element={<AuditLogsPage />} />
          <Route path="/migrations" element={<MigrationsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/all" element={<AllSessionsPage />} />
          <Route path="/sessions/user" element={<UserSessionsPage />} />
          <Route path="/sessions/revoke" element={<RevokeSessionPage />} />
          <Route path="/sessions/revoke-all" element={<RevokeAllSessionsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
