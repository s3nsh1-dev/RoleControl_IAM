import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Field } from '@/components/ui'
import { userIdSchema, type UserIdFormValues } from '@/validation/schemas'

type RevokeAllSessionsFormProps = {
  pending: boolean
  onRevokeAll: (userId: number) => void
}

export function RevokeAllSessionsForm({
  pending,
  onRevokeAll,
}: RevokeAllSessionsFormProps) {
  const form = useForm<UserIdFormValues>({
    resolver: zodResolver(userIdSchema),
    defaultValues: { userId: '' },
    mode: 'onBlur',
  })

  return (
    <form
      className="form-grid compact"
      onSubmit={form.handleSubmit((data) => onRevokeAll(Number(data.userId)))}
    >
      <Field
        label="User ID"
        type="number"
        min={1}
        error={form.formState.errors.userId?.message}
        {...form.register('userId')}
      />
      <Button type="submit" variant="danger" disabled={pending}>
        Revoke all sessions
      </Button>
    </form>
  )
}
