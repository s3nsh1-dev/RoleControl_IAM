import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cx } from '../../utils/format'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export function Field({ label, error, className, ...props }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-invalid={error ? true : undefined}
        className={cx('input', error && 'input-error', className)}
        {...props}
      />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}

type SelectFieldProps<T extends string> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange'
> & {
  label: string
  options: readonly T[]
  error?: string
  onChange?: SelectHTMLAttributes<HTMLSelectElement>['onChange']
  onValueChange?: (value: T) => void
}

export function SelectField<T extends string>({
  label,
  options,
  error,
  onChange,
  onValueChange,
  className,
  ...props
}: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-invalid={error ? true : undefined}
        className={cx('input', error && 'input-error', className)}
        onChange={(event) => {
          onChange?.(event)
          onValueChange?.(event.target.value as T)
        }}
        {...props}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
  onValueChange?: (value: string) => void
}

export function TextArea({
  label,
  error,
  onChange,
  onValueChange,
  className,
  ...props
}: TextAreaProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        aria-invalid={error ? true : undefined}
        className={cx('input textarea', error && 'input-error', className)}
        onChange={(event) => {
          onChange?.(event)
          onValueChange?.(event.target.value)
        }}
        {...props}
      />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}
