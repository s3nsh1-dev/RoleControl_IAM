import { useEffect, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form'
import type { z } from 'zod'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="button-row dialog-actions">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  )
}

export function EditDialog<TValues extends FieldValues>({
  open,
  title,
  defaultValues,
  schema,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  pending = false,
  children,
  onSubmit,
  onClose,
}: {
  open: boolean
  title: string
  defaultValues: DefaultValues<TValues>
  schema: z.ZodType<TValues>
  submitLabel?: string
  cancelLabel?: string
  pending?: boolean
  children: (form: UseFormReturn<TValues>) => ReactNode
  onSubmit: SubmitHandler<TValues>
  onClose: () => void
}) {
  const form = useForm<TValues>({
    resolver: zodResolver(schema) as Resolver<TValues>,
    defaultValues,
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) form.reset(defaultValues)
  }, [defaultValues, form, open])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-modal="true"
        className="confirm-dialog edit-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <h2>{title}</h2>
        <div className="dialog-form">{children(form)}</div>
        <div className="button-row dialog-actions">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
