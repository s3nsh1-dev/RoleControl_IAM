import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../utils/format'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export function Button({
  className,
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx('button', `button-${variant}`, className)}
      {...props}
    />
  )
}
