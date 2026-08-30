import type { UserListItem } from '@/api/types'
import { EditDialog, Field } from '@/components/ui'
import { editUserSchema, type EditUserFormValues } from '@/validation/schemas'

type EditUserDialogProps = {
  editingUser: UserListItem | null
  defaultValues: EditUserFormValues
  pending: boolean
  onClose: () => void
  onSubmit: (userId: number, fullname: string) => void
}

export function EditUserDialog({
  editingUser,
  defaultValues,
  pending,
  onClose,
  onSubmit,
}: EditUserDialogProps) {
  return (
    <EditDialog<EditUserFormValues>
      open={Boolean(editingUser)}
      title="Edit user"
      defaultValues={defaultValues}
      schema={editUserSchema}
      pending={pending}
      onClose={onClose}
      onSubmit={(data) => {
        if (!editingUser) return
        onSubmit(editingUser.id, data.fullname)
      }}
    >
      {(form) => (
        <Field
          label="Full name"
          error={form.formState.errors.fullname?.message}
          {...form.register('fullname')}
        />
      )}
    </EditDialog>
  )
}
