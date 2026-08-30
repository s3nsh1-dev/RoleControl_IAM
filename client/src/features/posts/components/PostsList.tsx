import type { PaginationMeta, Post } from '@/api/types'
import { PaginationControls } from '@/components/PaginationControls'
import { AsyncQueryPanel } from '@/components/shared'
import { PostCard } from './PostCard'

type PostsListProps = {
  posts?: Post[]
  pagination?: PaginationMeta
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
  canUpdate: boolean
  canDelete: boolean
  onPageChange: (page: number) => void
  onRetry: () => void
  onEdit: (post: Post) => void
  onDelete: (post: Post) => void
}

export function PostsList({
  posts,
  pagination,
  isLoading,
  isError,
  error,
  isFetching,
  canUpdate,
  canDelete,
  onPageChange,
  onRetry,
  onEdit,
  onDelete,
}: PostsListProps) {
  const hasData = Boolean(posts?.length)

  return (
    <>
      <AsyncQueryPanel
        isLoading={isLoading}
        isError={isError}
        error={error}
        isFetching={isFetching}
        hasData={hasData}
        emptyLabel="No posts returned."
        errorTitle="Unable to load posts"
        onRetry={onRetry}
      >
        {hasData && posts ? (
          <div className="record-grid">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onEdit={() => onEdit(post)}
                onDelete={() => onDelete(post)}
              />
            ))}
          </div>
        ) : null}
      </AsyncQueryPanel>
      <PaginationControls pagination={pagination} onPageChange={onPageChange} />
    </>
  )
}
