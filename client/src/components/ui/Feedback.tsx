import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../utils/format'

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index} />
      ))}
    </div>
  )
}

export function Badge({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span className={cx('badge', className)} {...props}>
      {children}
    </span>
  )
}
