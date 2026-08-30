import { Button } from '@/components/ui'

type RecordCardActionsProps = {
  canUpdate: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

export function RecordCardActions({
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: RecordCardActionsProps) {
  if (!canUpdate && !canDelete) {
    return null
  }

  return (
    <div className="button-row">
      {canUpdate ? <Button onClick={onEdit}>Edit</Button> : null}
      {canDelete ? (
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
      ) : null}
    </div>
  )
}
