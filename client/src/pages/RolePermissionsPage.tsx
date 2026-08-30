import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { rolePermissionsApi } from '@/api/services'
import { Panel } from '@/components/ui'
import { queryKeys } from '@/constants'
import {
  RolePermissionMutationForm,
  RolePermissionsAssignmentsTable,
} from '@/features/role-permissions'
import { useCapabilities } from '@/hooks/useAuth'
import { useConfirmAction } from '@/hooks/useConfirmAction'
import { groupRolePermissionAssignments } from '@/utils/rolePermissions'
import {
  rolePermissionSchema,
  type RolePermissionFormValues,
} from '@/validation/schemas'

export function RolePermissionsPage() {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const { confirm, confirmDialog } = useConfirmAction()
  const assignments = useQuery({
    queryKey: ['role-permissions', 'grouped'],
    queryFn: rolePermissionsApi.listAll,
    placeholderData: keepPreviousData,
  })
  const rolePermissionForm = useForm<RolePermissionFormValues>({
    resolver: zodResolver(rolePermissionSchema),
    defaultValues: { roleName: 'editor', action: 'view', resource: 'post' },
    mode: 'onBlur',
  })

  const invalidateRolePermissions = () =>
    queryClient.invalidateQueries({ queryKey: ['role-permissions'] })
  const invalidateAuthMe = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.authMe })
  const assign = useMutation({
    mutationFn: rolePermissionsApi.assign,
    onSuccess: () => {
      toast.success('Permission assigned to role')
      invalidateRolePermissions()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })
  const revoke = useMutation({
    mutationFn: rolePermissionsApi.revoke,
    onSuccess: () => {
      toast.success('Permission revoked from role')
      invalidateRolePermissions()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })

  const groupedAssignments = useMemo(
    () => groupRolePermissionAssignments(assignments.data?.assignments ?? []),
    [assignments.data?.assignments],
  )

  return (
    <div className="page-stack">
      {can('rolePermissions.assign') || can('rolePermissions.revoke') ? (
        <RolePermissionMutationForm
          form={rolePermissionForm}
          canAssign={can('rolePermissions.assign')}
          canRevoke={can('rolePermissions.revoke')}
          assignPending={assign.isPending}
          revokePending={revoke.isPending}
          onAssign={(data) => assign.mutate(data)}
          confirm={confirm}
          onRevoke={(data) => revoke.mutate(data)}
        />
      ) : null}
      <Panel title="Role-permission assignments">
        <RolePermissionsAssignmentsTable
          isLoading={assignments.isLoading}
          isError={assignments.isError}
          error={assignments.error}
          isFetching={assignments.isFetching}
          groupedAssignments={groupedAssignments}
          onRetry={() => void assignments.refetch()}
        />
      </Panel>
      {confirmDialog}
    </div>
  )
}
