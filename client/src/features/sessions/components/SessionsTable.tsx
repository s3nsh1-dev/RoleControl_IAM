import type { Session } from '@/api/types'
import { Badge } from '@/components/ui'
import { formatDate } from '@/utils/format'

type SessionsTableProps = {
  sessions: Session[]
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>User ID</th>
          <th>User Name</th>
          <th>Device</th>
          <th>Status</th>
          <th>Expires At</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((session) => (
          <tr key={session.id}>
            <td>{session.id}</td>
            <td>{session.user_id}</td>
            <td>{session.user_fullname}</td>
            <td>{session.device_info ?? <span className="muted">Unknown</span>}</td>
            <td>
              <Badge
                className={session.is_active ? 'badge-active' : 'badge-inactive'}
              >
                {session.is_active ? 'ACTIVE' : session.revoked_at ? 'REVOKED' : 'EXPIRED'}
              </Badge>
            </td>
            <td>{formatDate(session.expires_at)}</td>
            <td>{formatDate(session.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
