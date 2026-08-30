import type { Role, RoleName } from '@/api/types'
import { EditDialog, Field } from '@/components/ui'
import { editRoleSchema, type EditRoleFormValues } from '@/validation/schemas'

type EditRoleDialogProps = {
  editingRole: Role | null
  defaultValues: EditRoleFormValues
  pending: boolean
  onClose: () => void
  onSubmit: (roleName: RoleName, description: string) => void
}

export function EditRoleDialog({
  editingRole,
  defaultValues,
  pending,
  onClose,
  onSubmit,
}: EditRoleDialogProps) {
  return (
    <EditDialog<EditRoleFormValues>
      open={Boolean(editingRole)}
      title="Edit role"
      defaultValues={defaultValues}
      schema={editRoleSchema}
      pending={pending}
      onClose={onClose}
      onSubmit={(data) => {
        if (!editingRole) return
        onSubmit(editingRole.name, data.description)
      }}
    >
      {(form) => (
        <Field
          label="Description"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />
      )}
    </EditDialog>
  )
}
