import { FileText, MonitorSmartphone, ScrollText } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import type { NavItem } from '@/constants'
import { capabilities } from '@/test/fixtures'
import { hasCapability, visibleNavItem } from '../navVisibility'

describe('hasCapability', () => {
  it('allows ungated items and checks gated capabilities', () => {
    expect(hasCapability(undefined)).toBe(true)
    expect(hasCapability(capabilities('posts.view'), 'posts.view')).toBe(true)
    expect(hasCapability(capabilities('posts.view'), 'posts.create')).toBe(false)
  })
})

describe('visibleNavItem', () => {
  it('keeps public nav items and hides missing gated items', () => {
    const publicItem: NavItem = { to: '/posts', label: 'Posts', icon: FileText }
    const gatedItem: NavItem = {
      to: '/logs',
      label: 'Logs',
      icon: ScrollText,
      capability: 'auditLogs.view',
    }

    expect(visibleNavItem(publicItem, undefined)).toEqual(publicItem)
    expect(visibleNavItem(gatedItem, capabilities('posts.view'))).toBeNull()
    expect(visibleNavItem(gatedItem, capabilities('auditLogs.view'))).toEqual(gatedItem)
  })

  it('keeps a nav group only when at least one child is visible', () => {
    const group: NavItem = {
      to: '/sessions',
      label: 'Sessions',
      icon: MonitorSmartphone,
      children: [
        {
          to: '/sessions/all',
          label: 'All sessions',
          icon: MonitorSmartphone,
          capability: 'sessions.view',
        },
        {
          to: '/sessions/revoke',
          label: 'Revoke',
          icon: MonitorSmartphone,
          capability: 'sessions.revoke',
        },
      ],
    }

    expect(visibleNavItem(group, capabilities('posts.view'))).toBeNull()
    expect(visibleNavItem(group, capabilities('sessions.revoke'))).toMatchObject({
      to: '/sessions/revoke',
      children: [{ to: '/sessions/revoke' }],
    })
  })
})
