import type { Role } from '@/api/types'
import { RecordCardActions } from '@/components/shared'
import { Badge } from '@/components/ui'

type RoleCardProps = {
  role: Role
  canUpdate: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

export function RoleCard({
  role,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: RoleCardProps) {
  return (
    <article className="record-card">
      <div>
        <Badge>{role.name}</Badge>
        <p>{role.description ?? 'No description'}</p>
      </div>
      <RecordCardActions
        canUpdate={canUpdate}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </article>
  )
}
