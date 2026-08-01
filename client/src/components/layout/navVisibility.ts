import type { CapabilityKey } from '@/api/types'
import type { NavItem } from '@/constants'

export const hasCapability = (
  capabilities: readonly CapabilityKey[] | undefined,
  capability?: CapabilityKey,
) => !capability || Boolean(capabilities?.includes(capability))

export const visibleNavItem = (
  item: NavItem,
  capabilities: readonly CapabilityKey[] | undefined,
): NavItem | null => {
  const children = item.children
    ?.map((child) => visibleNavItem(child, capabilities))
    .filter((child): child is NavItem => Boolean(child))

  if (item.children) {
    if (!children?.length) return null
    return { ...item, to: children[0].to, children }
  }

  return hasCapability(capabilities, item.capability) ? item : null
}
