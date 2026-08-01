import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { rolesApi } from '@/api/services'
import type { Role, RoleName } from '@/api/types'
import { Panel } from '@/components/ui'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { CreateRoleForm, EditRoleDialog, RolesList } from '@/features/roles'
import { useCapabilities } from '@/hooks/useAuth'
import { useConfirmAction } from '@/hooks/useConfirmAction'
import {
  createRoleSchema,
  type CreateRoleFormValues,
} from '@/validation/schemas'

export function RolesPage() {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const { confirm, confirmDialog } = useConfirmAction()
  const [page, setPage] = useState(1)
  const roles = useQuery({
    queryKey: queryKeys.roles(page),
    queryFn: () => rolesApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const createRoleForm = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: 'editor', description: '' },
    mode: 'onBlur',
  })
  const editRoleDefaults = useMemo(
    () => ({ description: editingRole?.description ?? '' }),
    [editingRole?.description],
  )

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ['roles'] })
  const invalidateAuthMe = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.authMe })
  const createRole = useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => {
      toast.success('Role created')
      createRoleForm.reset({ name: 'editor', description: '' })
      invalidateRoles()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })
  const updateRole = useMutation({
    mutationFn: ({
      roleName,
      description: nextDescription,
    }: {
      roleName: RoleName
      description: string
    }) => rolesApi.update(roleName, { description: nextDescription }),
    onSuccess: () => {
      toast.success('Role updated')
      setEditingRole(null)
      invalidateRoles()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })
  const deleteRole = useMutation({
    mutationFn: rolesApi.remove,
    onSuccess: () => {
      toast.success('Role deleted')
      invalidateRoles()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="page-stack">
      {can('roles.create') ? (
        <CreateRoleForm
          form={createRoleForm}
          onSubmit={(data) => createRole.mutate(data)}
          isPending={createRole.isPending}
        />
      ) : null}
      <Panel title="Roles">
        <RolesList
          roles={roles.data?.roles}
          pagination={roles.data?.pagination}
          isLoading={roles.isLoading}
          isError={roles.isError}
          error={roles.error}
          isFetching={roles.isFetching}
          canUpdate={can('roles.update')}
          canDelete={can('roles.delete')}
          onPageChange={setPage}
          onRetry={() => void roles.refetch()}
          onEdit={setEditingRole}
          onDelete={(role) =>
            confirm({
              title: 'Delete role',
              description: `Delete role ${role.name}?`,
              confirmLabel: 'Delete',
              onConfirm: () => deleteRole.mutate(role.name),
            })
          }
        />
      </Panel>
      <EditRoleDialog
        editingRole={editingRole}
        defaultValues={editRoleDefaults}
        pending={updateRole.isPending}
        onClose={() => setEditingRole(null)}
        onSubmit={(roleName, description) =>
          updateRole.mutate({ roleName, description })
        }
      />
      {confirmDialog}
    </div>
  )
}
