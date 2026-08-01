import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Field } from '@/components/ui'
import { sessionIdSchema, type SessionIdFormValues } from '@/validation/schemas'

type RevokeSessionFormProps = {
  pending: boolean
  onRevoke: (sessionId: number) => void
}

export function RevokeSessionForm({ pending, onRevoke }: RevokeSessionFormProps) {
  const form = useForm<SessionIdFormValues>({
    resolver: zodResolver(sessionIdSchema),
    defaultValues: { sessionId: '' },
    mode: 'onBlur',
  })

  return (
    <form
      className="form-grid compact"
      onSubmit={form.handleSubmit((data) => onRevoke(Number(data.sessionId)))}
    >
      <Field
        label="Session ID"
        type="number"
        min={1}
        error={form.formState.errors.sessionId?.message}
        {...form.register('sessionId')}
      />
      <Button type="submit" variant="danger" disabled={pending}>
        Revoke
      </Button>
    </form>
  )
}
