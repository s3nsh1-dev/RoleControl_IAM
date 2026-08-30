import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { sessionsApi } from '@/api/services'
import { Panel } from '@/components/ui'
import { AccessDenied } from '@/components/shared'
import {
  AllSessionsList,
  RevokeAllSessionsForm,
  RevokeSessionForm,
  UserSessionsLookup,
} from '@/features/sessions'
import { useCapabilities } from '@/hooks/useAuth'
import { useConfirmAction } from '@/hooks/useConfirmAction'

export function SessionsPage() {
  const { can } = useCapabilities()

  if (can('sessions.view')) return <Navigate to="/sessions/all" replace />
  if (can('sessions.revoke')) return <Navigate to="/sessions/revoke" replace />
  if (can('sessions.delete')) return <Navigate to="/sessions/revoke-all" replace />

  return <AccessDenied />
}

export function AllSessionsPage() {
  const { can } = useCapabilities()

  if (!can('sessions.view')) {
    return <AccessDenied />
  }

  return (
    <div className="page-stack">
      <Panel title="All Sessions" description="All active and inactive sessions.">
        <AllSessionsList />
      </Panel>
    </div>
  )
}

export function UserSessionsPage() {
  const { can } = useCapabilities()

  if (!can('sessions.view')) {
    return <AccessDenied />
  }

  return (
    <div className="page-stack">
      <Panel title="User Sessions" description="Lookup sessions by user ID.">
        <UserSessionsLookup />
      </Panel>
    </div>
  )
}

export function RevokeSessionPage() {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const { confirm, confirmDialog } = useConfirmAction()

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    queryClient.invalidateQueries({ queryKey: ['user-sessions'] })
  }

  const revokeSession = useMutation({
    mutationFn: sessionsApi.revoke,
    onSuccess: () => {
      toast.success('Session revoked')
      invalidateSessions()
    },
    onError: (error) => toast.error(error.message),
  })

  if (!can('sessions.revoke')) {
    return <AccessDenied />
  }

  return (
    <div className="page-stack">
      <Panel title="Revoke Session" description="Revoke one session by ID.">
        <RevokeSessionForm
          pending={revokeSession.isPending}
          onRevoke={(sessionId) =>
            confirm({
              title: 'Revoke session',
              description: `Revoke session ${sessionId}?`,
              confirmLabel: 'Revoke',
              onConfirm: () => revokeSession.mutate(sessionId),
            })
          }
        />
      </Panel>
      {confirmDialog}
    </div>
  )
}

export function RevokeAllSessionsPage() {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const { confirm, confirmDialog } = useConfirmAction()

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    queryClient.invalidateQueries({ queryKey: ['user-sessions'] })
  }

  const revokeAllSessions = useMutation({
    mutationFn: sessionsApi.revokeAllByUser,
    onSuccess: (data) => {
      toast.success(`${data.revokedCount} sessions revoked`)
      invalidateSessions()
    },
    onError: (error) => toast.error(error.message),
  })

  if (!can('sessions.delete')) {
    return <AccessDenied />
  }

  return (
    <div className="page-stack">
      <Panel
        title="Revoke All Sessions"
        description="Revoke all sessions for one user."
      >
        <RevokeAllSessionsForm
          pending={revokeAllSessions.isPending}
          onRevokeAll={(userId) =>
            confirm({
              title: 'Revoke all sessions',
              description: `Revoke all sessions for user ${userId}?`,
              confirmLabel: 'Revoke all',
              onConfirm: () => revokeAllSessions.mutate(userId),
            })
          }
        />
      </Panel>
      {confirmDialog}
    </div>
  )
}
