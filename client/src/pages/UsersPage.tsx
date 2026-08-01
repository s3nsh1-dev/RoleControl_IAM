import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { usersApi, userRolesApi } from '@/api/services'
import type { RoleName, UserListItem } from '@/api/types'
import { Panel } from '@/components/ui'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import {
  AssignRevokeRoleForm,
  CreateUserForm,
  EditUserDialog,
  UsersTable,
} from '@/features/users'
import { useCapabilities } from '@/hooks/useAuth'
import { useConfirmAction } from '@/hooks/useConfirmAction'
import {
  assignRoleSchema,
  createUserSchema,
  type AssignRoleFormValues,
  type CreateUserFormValues,
} from '@/validation/schemas'

export function UsersPage() {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const { confirm, confirmDialog } = useConfirmAction()
  const [page, setPage] = useState(1)
  const users = useQuery({
    queryKey: queryKeys.users(page),
    queryFn: () => usersApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullname: '', email: '', password: '', roleName: 'user' },
    mode: 'onBlur',
  })
  const assignRoleForm = useForm<AssignRoleFormValues>({
    resolver: zodResolver(assignRoleSchema),
    defaultValues: { userId: '', roleName: 'user' },
    mode: 'onBlur',
  })
  const editUserDefaults = useMemo(
    () => ({ fullname: editingUser?.fullname ?? '' }),
    [editingUser?.fullname],
  )

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: ['users'] })
  const invalidateAuthMe = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.authMe })

  const createUser = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success('User created')
      createUserForm.reset({ fullname: '', email: '', password: '', roleName: 'user' })
      invalidateUsers()
    },
    onError: (error) => toast.error(error.message),
  })

  const updateUser = useMutation({
    mutationFn: ({
      userId,
      fullname: nextFullname,
    }: {
      userId: number
      fullname: string
    }) => usersApi.update(userId, { fullname: nextFullname }),
    onSuccess: () => {
      toast.success('User updated')
      setEditingUser(null)
      invalidateUsers()
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteUser = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      toast.success('User deleted')
      invalidateUsers()
    },
    onError: (error) => toast.error(error.message),
  })

  const assignRole = useMutation({
    mutationFn: ({
      userId,
      roleName: nextRoleName,
    }: {
      userId: number
      roleName: RoleName
    }) => userRolesApi.assign(userId, { roleName: nextRoleName }),
    onSuccess: () => {
      toast.success('Role assigned')
      invalidateUsers()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })

  const revokeRole = useMutation({
    mutationFn: ({
      userId,
      roleName: nextRoleName,
    }: {
      userId: number
      roleName: RoleName
    }) => userRolesApi.revoke(userId, { roleName: nextRoleName }),
    onSuccess: () => {
      toast.success('Role revoked')
      invalidateUsers()
      invalidateAuthMe()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="page-grid">
      {can('users.create') ? (
        <CreateUserForm
          form={createUserForm}
          onSubmit={(data) => createUser.mutate(data)}
          isPending={createUser.isPending}
        />
      ) : null}

      {can('users.assignRole') || can('users.revokeRole') ? (
        <AssignRevokeRoleForm
          form={assignRoleForm}
          canAssign={can('users.assignRole')}
          canRevoke={can('users.revokeRole')}
          assignPending={assignRole.isPending}
          revokePending={revokeRole.isPending}
          onAssign={(data) =>
            assignRole.mutate({
              userId: Number(data.userId),
              roleName: data.roleName,
            })
          }
          confirm={confirm}
          onRevoke={(data) =>
            revokeRole.mutate({
              userId: Number(data.userId),
              roleName: data.roleName,
            })
          }
        />
      ) : null}

      <Panel
        title="Users"
        description="Backend user records returned by the public DTO contract."
      >
        <UsersTable
          users={users.data?.users}
          pagination={users.data?.pagination}
          isLoading={users.isLoading}
          isError={users.isError}
          error={users.error}
          isFetching={users.isFetching}
          canUpdate={can('users.update')}
          canDelete={can('users.delete')}
          onPageChange={setPage}
          onRetry={() => void users.refetch()}
          onEdit={setEditingUser}
          onDelete={(user) => deleteUser.mutate(user.id)}
          confirm={confirm}
        />
      </Panel>
      <EditUserDialog
        editingUser={editingUser}
        defaultValues={editUserDefaults}
        pending={updateUser.isPending}
        onClose={() => setEditingUser(null)}
        onSubmit={(userId, fullname) => updateUser.mutate({ userId, fullname })}
      />
      {confirmDialog}
    </div>
  )
}
