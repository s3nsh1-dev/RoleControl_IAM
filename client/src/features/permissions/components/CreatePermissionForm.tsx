import type { UseFormReturn } from 'react-hook-form'
import { permissionActions, permissionResources } from '@/api/types'
import { Button, Field, Panel, SelectField } from '@/components/ui'
import type { CreatePermissionFormValues } from '@/validation/schemas'

type CreatePermissionFormProps = {
  form: UseFormReturn<CreatePermissionFormValues>
  onSubmit: (data: CreatePermissionFormValues) => void
  isPending: boolean
}

export function CreatePermissionForm({
  form,
  onSubmit,
  isPending,
}: CreatePermissionFormProps) {
  return (
    <Panel title="Create permission">
      <form
        className="form-grid compact"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <SelectField
          label="Action"
          options={permissionActions}
          error={form.formState.errors.action?.message}
          {...form.register('action')}
        />
        <SelectField
          label="Resource"
          options={permissionResources}
          error={form.formState.errors.resource?.message}
          {...form.register('resource')}
        />
        <Field
          label="Description"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />
        <Button variant="primary" disabled={isPending}>
          Create permission
        </Button>
      </form>
    </Panel>
  )
}
