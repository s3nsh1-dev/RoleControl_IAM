import type { AuditLog } from '@/api/types'
import { Badge } from '@/components/ui'
import { formatDate } from '@/utils/format'
import { JsonPreview } from './JsonPreview'

type AuditLogsTableProps = {
  auditLogs: AuditLog[]
}

export function AuditLogsTable({ auditLogs }: AuditLogsTableProps) {
  return (
    <div className="table-wrap">
      <table className="table-wide">
        <thead>
          <tr>
            <th>ID</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Resource ID</th>
            <th>Old Values</th>
            <th>New Values</th>
            <th>Metadata</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {auditLogs.map((auditLog) => (
            <tr key={auditLog.id}>
              <td>{auditLog.id}</td>
              <td>
                {auditLog.actor_fullname ?? (
                  <span className="muted">System actor</span>
                )}
              </td>
              <td>
                <Badge>{auditLog.action_type}</Badge>
              </td>
              <td>{auditLog.resource_type}</td>
              <td>{auditLog.resource_id}</td>
              <td>
                <JsonPreview value={auditLog.old_values} />
              </td>
              <td>
                <JsonPreview value={auditLog.new_values} />
              </td>
              <td>
                <JsonPreview value={auditLog.metadata} />
              </td>
              <td>{formatDate(auditLog.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
