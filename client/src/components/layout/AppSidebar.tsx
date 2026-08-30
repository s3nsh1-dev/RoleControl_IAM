import { ChevronDown } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItem } from '@/constants'
import { cx } from '@/utils/format'

type AppSidebarProps = {
  visibleNavItems: NavItem[]
  openNavGroups: Record<string, boolean>
  onToggleNavGroup: (label: string) => void
  sidebarOpen: boolean
  onCloseSidebar: () => void
}

export function AppSidebar({
  visibleNavItems,
  openNavGroups,
  onToggleNavGroup,
  sidebarOpen,
  onCloseSidebar,
}: AppSidebarProps) {
  const location = useLocation()

  return (
    <>
      <aside className={cx('sidebar', sidebarOpen && 'open')}>
        <div className="brand">
          <div className="brand-mark">RC</div>
          <div>
            <strong>RoleControl IAM</strong>
            <span>Identity and access management</span>
          </div>
        </div>

        <nav className="nav-list">
          {visibleNavItems.map((item) => {
            const isGroupOpen = Boolean(openNavGroups[item.label])
            const isGroupActive =
              item.children?.some((child) =>
                location.pathname.startsWith(child.to),
              ) ?? false

            if (item.children) {
              return (
                <div key={item.label} className="nav-group">
                  <button
                    type="button"
                    className={cx(
                      'nav-item nav-accordion-trigger',
                      isGroupActive && 'active',
                    )}
                    aria-expanded={isGroupOpen}
                    onClick={() => onToggleNavGroup(item.label)}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    <ChevronDown
                      className={cx(
                        'nav-accordion-icon',
                        isGroupOpen && 'open',
                      )}
                      size={16}
                    />
                  </button>
                  {isGroupOpen ? (
                    <div className="nav-sub-list">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className="nav-sub-item"
                          onClick={onCloseSidebar}
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="nav-item"
                onClick={onCloseSidebar}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {sidebarOpen ? (
        <div
          className="sidebar-backdrop"
          onClick={onCloseSidebar}
          aria-hidden="true"
        />
      ) : null}
    </>
  )
}
