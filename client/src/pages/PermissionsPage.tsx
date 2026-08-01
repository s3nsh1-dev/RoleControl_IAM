import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { permissionsApi } from '@/api/services'
import { Panel } from '@/components/ui'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { CreatePermissionForm, PermissionsTable } from '@/features/permissions'
import { useCapabilities } from '@/hooks/useAuth'
import { useConfirmAction } from '@/hooks/useConfirmAction'
import {
  createPermissionSchema,
  type CreatePermissionFormValues,
} from '@/validation/schemas'

export function PermissionsPage() {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const { confirm, confirmDialog } = useConfirmAction()
  const [page, setPage] = useState(1)
  const permissions = useQuery({
    queryKey: queryKeys.permissions(page),
    queryFn: () => permissionsApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const createPermissionForm = useForm<CreatePermissionFormValues>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: { action: 'view', resource: 'post', description: '' },
    mode: 'onBlur',
  })

  const invalidatePermissions = () =>
    queryClient.invalidateQueries({ queryKey: ['permissions'] })
  const invalidateAuthMe = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.authMe })
  const createPermission = useMutation({
    mutationFn: permissionsApi.create,
    onSuccess: () => {
      toast.success('Permission created')
      createPermissionForm.reset({ action: 'view', resource: 'post', description: '' })
      invalidatePermissions()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })
  const deletePermission = useMutation({
    mutationFn: permissionsApi.remove,
    onSuccess: () => {
      toast.success('Permission deleted')
      invalidatePermissions()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="page-stack">
      {can('permissions.create') ? (
        <CreatePermissionForm
          form={createPermissionForm}
          onSubmit={(data) => createPermission.mutate(data)}
          isPending={createPermission.isPending}
        />
      ) : null}
      <Panel title="Permissions">
        <PermissionsTable
          permissions={permissions.data?.permissions}
          pagination={permissions.data?.pagination}
          isLoading={permissions.isLoading}
          isError={permissions.isError}
          error={permissions.error}
          isFetching={permissions.isFetching}
          canDelete={can('permissions.delete')}
          onPageChange={setPage}
          onRetry={() => void permissions.refetch()}
          onDelete={(permissionId) => deletePermission.mutate(permissionId)}
          confirm={confirm}
        />
      </Panel>
      {confirmDialog}
    </div>
  )
}
