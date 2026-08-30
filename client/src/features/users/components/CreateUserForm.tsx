import type { UseFormReturn } from 'react-hook-form'
import { roleNames } from '@/api/types'
import { Button, Field, Panel, SelectField } from '@/components/ui'
import type { CreateUserFormValues } from '@/validation/schemas'

type CreateUserFormProps = {
  form: UseFormReturn<CreateUserFormValues>
  onSubmit: (data: CreateUserFormValues) => void
  isPending: boolean
}

export function CreateUserForm({ form, onSubmit, isPending }: CreateUserFormProps) {
  return (
    <Panel
      title="Create user"
      description="Creates a user and assigns the initial role."
    >
      <form className="form-grid" onSubmit={form.handleSubmit(onSubmit)}>
        <Field
          label="Full name"
          error={form.formState.errors.fullname?.message}
          {...form.register('fullname')}
        />
        <Field
          label="Email"
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Field
          label="Password"
          type="password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <SelectField
          label="Initial role"
          options={roleNames}
          error={form.formState.errors.roleName?.message}
          {...form.register('roleName')}
        />
        <Button variant="primary" disabled={isPending}>
          Create user
        </Button>
      </form>
    </Panel>
  )
}
