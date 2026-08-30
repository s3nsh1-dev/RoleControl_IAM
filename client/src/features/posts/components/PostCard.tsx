import type { Post } from '@/api/types'
import { RecordCardActions } from '@/components/shared'
import { formatDate } from '@/utils/format'

type PostCardProps = {
  post: Post
  canUpdate: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

export function PostCard({
  post,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: PostCardProps) {
  return (
    <article className="record-card">
      <div>
        <div className="record-heading">
          <h3>{post.title}</h3>
          <span
            style={{
              color: 'var(--muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            [{post.owner_id}] {post.owner_fullname}
          </span>
        </div>
        <p>{post.content ?? 'No content'}</p>
        <span className="muted">
          Created {formatDate(post.created_at)}
          {post.behalf_of ? ` · behalf of ${post.behalf_of}` : ''}
        </span>
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
