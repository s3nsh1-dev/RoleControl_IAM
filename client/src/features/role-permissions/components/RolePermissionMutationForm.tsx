import type { UseFormReturn } from 'react-hook-form'
import { permissionActions, permissionResources, roleNames } from '@/api/types'
import { Button, Panel, SelectField } from '@/components/ui'
import type { useConfirmAction } from '@/hooks/useConfirmAction'
import type { RolePermissionFormValues } from '@/validation/schemas'

type RolePermissionMutationFormProps = {
  form: UseFormReturn<RolePermissionFormValues>
  canAssign: boolean
  canRevoke: boolean
  assignPending: boolean
  revokePending: boolean
  onAssign: (data: RolePermissionFormValues) => void
  confirm: ReturnType<typeof useConfirmAction>['confirm']
  onRevoke: (data: RolePermissionFormValues) => void
}

export function RolePermissionMutationForm({
  form,
  canAssign,
  canRevoke,
  assignPending,
  revokePending,
  onAssign,
  confirm,
  onRevoke,
}: RolePermissionMutationFormProps) {
  return (
    <Panel
      title="Role-permission mutation"
      description="These endpoints are audited by the backend."
    >
      <form
        className="form-grid compact"
        onSubmit={form.handleSubmit(onAssign)}
      >
        <SelectField
          label="Role"
          options={roleNames}
          error={form.formState.errors.roleName?.message}
          {...form.register('roleName')}
        />
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
                  title: 'Revoke permission',
                  description: `Revoke ${data.action}:${data.resource} from ${data.roleName}?`,
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
