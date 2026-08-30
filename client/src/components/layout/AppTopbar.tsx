import { LogOut, Menu } from 'lucide-react'
import type { AuthMeData } from '@/api/types'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui'

type AppTopbarProps = {
  access: AuthMeData | undefined
  isLoading: boolean
  sidebarOpen: boolean
  onOpenSidebar: () => void
  logoutPending: boolean
  onLogout: () => void
}

export function AppTopbar({
  access,
  isLoading,
  sidebarOpen,
  onOpenSidebar,
  logoutPending,
  onLogout,
}: AppTopbarProps) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="sidebar-toggle"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        aria-expanded={sidebarOpen}
      >
        <Menu size={24} />
      </button>
      <div>
        <span className="eyebrow">Authenticated workspace</span>
        <h1>{access?.user.fullname ?? 'RoleControl operator'}</h1>
      </div>
      <div className="session-box">
        <ThemeToggle />
        <div className="session-info">
          <strong>
            {access?.user.email ??
              (isLoading ? 'Loading session' : 'Session unavailable')}
          </strong>
          <span>
            {access?.roles.length
              ? access.roles.join(', ')
              : 'No roles returned'}
          </span>
        </div>
        <Button
          variant="ghost"
          type="button"
          disabled={logoutPending}
          onClick={onLogout}
          title="Log out"
        >
          <LogOut size={16} />
          Logout
        </Button>
      </div>
    </header>
  )
}
