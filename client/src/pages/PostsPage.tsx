import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { postsApi } from '@/api/services'
import type { Post } from '@/api/types'
import { Panel } from '@/components/ui'
import { DEFAULT_PAGE_SIZE, queryKeys } from '@/constants'
import { CreatePostForm, EditPostDialog, PostsList } from '@/features/posts'
import { useCapabilities } from '@/hooks/useAuth'
import { useConfirmAction } from '@/hooks/useConfirmAction'
import {
  createPostSchema,
  type CreatePostFormValues,
} from '@/validation/schemas'

export function PostsPage() {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const { confirm, confirmDialog } = useConfirmAction()
  const [page, setPage] = useState(1)
  const posts = useQuery({
    queryKey: queryKeys.posts(page),
    queryFn: () => postsApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const createPostForm = useForm<CreatePostFormValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: '', content: '', behalfUserId: '' },
    mode: 'onBlur',
  })
  const editPostDefaults = useMemo(
    () => ({
      title: editingPost?.title ?? '',
      content: editingPost?.content ?? '',
    }),
    [editingPost?.content, editingPost?.title],
  )

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['posts'] })
  const createPost = useMutation({
    mutationFn: postsApi.create,
    onSuccess: () => {
      toast.success('Post created')
      createPostForm.reset({ title: '', content: '', behalfUserId: '' })
      invalidate()
    },
    onError: (error) => toast.error(error.message),
  })
  const createOnBehalf = useMutation({
    mutationFn: ({
      userId,
      title: nextTitle,
      content: nextContent,
    }: {
      userId: number
      title: string
      content: string
    }) =>
      postsApi.createOnBehalf(userId, {
        title: nextTitle,
        content: nextContent || null,
      }),
    onSuccess: () => {
      toast.success('Post created on behalf of user')
      createPostForm.reset({ title: '', content: '', behalfUserId: '' })
      invalidate()
    },
    onError: (error) => toast.error(error.message),
  })
  const updatePost = useMutation({
    mutationFn: ({
      postId,
      title: nextTitle,
      content: nextContent,
    }: {
      postId: number
      title: string
      content: string | null
    }) => postsApi.update(postId, { title: nextTitle, content: nextContent }),
    onSuccess: () => {
      toast.success('Post updated')
      setEditingPost(null)
      invalidate()
    },
    onError: (error) => toast.error(error.message),
  })
  const deletePost = useMutation({
    mutationFn: postsApi.remove,
    onSuccess: () => {
      toast.success('Post deleted')
      invalidate()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="page-stack">
      {can('posts.create') ? (
        <CreatePostForm
          form={createPostForm}
          canCreateOnBehalf={can('posts.createOnBehalf')}
          isPending={createPost.isPending || createOnBehalf.isPending}
          onSubmit={(data) => {
            if (can('posts.createOnBehalf') && data.behalfUserId) {
              createOnBehalf.mutate({
                userId: Number(data.behalfUserId),
                title: data.title,
                content: data.content,
              })
              return
            }
            createPost.mutate({ title: data.title, content: data.content || null })
          }}
        />
      ) : null}
      <Panel title="Posts">
        <PostsList
          posts={posts.data?.posts}
          pagination={posts.data?.pagination}
          isLoading={posts.isLoading}
          isError={posts.isError}
          error={posts.error}
          isFetching={posts.isFetching}
          canUpdate={can('posts.update')}
          canDelete={can('posts.delete')}
          onPageChange={setPage}
          onRetry={() => void posts.refetch()}
          onEdit={setEditingPost}
          onDelete={(post) =>
            confirm({
              title: 'Delete post',
              description: `Delete post "${post.title}"?`,
              confirmLabel: 'Delete',
              onConfirm: () => deletePost.mutate(post.id),
            })
          }
        />
      </Panel>
      <EditPostDialog
        editingPost={editingPost}
        defaultValues={editPostDefaults}
        pending={updatePost.isPending}
        onClose={() => setEditingPost(null)}
        onSubmit={(postId, title, content) =>
          updatePost.mutate({ postId, title, content })
        }
      />
      {confirmDialog}
    </div>
  )
}
