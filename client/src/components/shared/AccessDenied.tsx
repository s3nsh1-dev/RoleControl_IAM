import { EmptyState } from '@/components/ui'

export function AccessDenied() {
  return (
    <div className="page-stack">
      <EmptyState>Access denied</EmptyState>
    </div>
  )
}
