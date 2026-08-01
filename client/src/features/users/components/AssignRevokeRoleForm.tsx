import type { UseFormReturn } from 'react-hook-form'
import { roleNames } from '@/api/types'
import { Button, Field, Panel, SelectField } from '@/components/ui'
import type { useConfirmAction } from '@/hooks/useConfirmAction'
import type { AssignRoleFormValues } from '@/validation/schemas'

type AssignRevokeRoleFormProps = {
  form: UseFormReturn<AssignRoleFormValues>
  canAssign: boolean
  canRevoke: boolean
  assignPending: boolean
  revokePending: boolean
  onAssign: (data: AssignRoleFormValues) => void
  confirm: ReturnType<typeof useConfirmAction>['confirm']
  onRevoke: (data: AssignRoleFormValues) => void
}

export function AssignRevokeRoleForm({
  form,
  canAssign,
  canRevoke,
  assignPending,
  revokePending,
  onAssign,
  confirm,
  onRevoke,
}: AssignRevokeRoleFormProps) {
  return (
    <Panel
      title="Assign or revoke role"
      description="Use confirmations for audited role mutations."
    >
      <form className="form-grid" onSubmit={form.handleSubmit(onAssign)}>
        <Field
          label="User ID"
          type="number"
          min={1}
          error={form.formState.errors.userId?.message}
          {...form.register('userId')}
        />
        <SelectField
          label="Role"
          options={roleNames}
          error={form.formState.errors.roleName?.message}
          {...form.register('roleName')}
        />
        <div className="button-row">
          {canAssign ? (
            <Button type="submit" variant="primary" disabled={assignPending}>
              Assign
            </Button>
          ) : null}
          {canRevoke ? (
            <Button
              type="button"
              variant="danger"
              disabled={revokePending}
              onClick={form.handleSubmit((data) =>
                confirm({
                  title: 'Revoke role',
                  description: `Revoke ${data.roleName} from user ${data.userId}?`,
                  confirmLabel: 'Revoke',
                  onConfirm: () => onRevoke(data),
                }),
              )}
            >
              Revoke
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  )
}
