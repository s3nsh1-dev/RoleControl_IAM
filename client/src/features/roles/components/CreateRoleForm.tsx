import type { UseFormReturn } from 'react-hook-form'
import { roleNames } from '@/api/types'
import { Button, Field, Panel, SelectField } from '@/components/ui'
import type { CreateRoleFormValues } from '@/validation/schemas'

type CreateRoleFormProps = {
  form: UseFormReturn<CreateRoleFormValues>
  onSubmit: (data: CreateRoleFormValues) => void
  isPending: boolean
}

export function CreateRoleForm({ form, onSubmit, isPending }: CreateRoleFormProps) {
  return (
    <Panel
      title="Create role"
      description="Role names are constrained by the backend enum."
    >
      <form
        className="form-grid compact"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <SelectField
          label="Role name"
          options={roleNames}
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <Field
          label="Description"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />
        <Button variant="primary" disabled={isPending}>
          Create role
        </Button>
      </form>
    </Panel>
  )
}
