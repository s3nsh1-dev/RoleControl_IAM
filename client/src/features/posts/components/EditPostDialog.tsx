import type { Post } from '@/api/types'
import { EditDialog, Field, TextArea } from '@/components/ui'
import { editPostSchema, type EditPostFormValues } from '@/validation/schemas'

type EditPostDialogProps = {
  editingPost: Post | null
  defaultValues: EditPostFormValues
  pending: boolean
  onClose: () => void
  onSubmit: (postId: number, title: string, content: string | null) => void
}

export function EditPostDialog({
  editingPost,
  defaultValues,
  pending,
  onClose,
  onSubmit,
}: EditPostDialogProps) {
  return (
    <EditDialog<EditPostFormValues>
      open={Boolean(editingPost)}
      title="Edit post"
      defaultValues={defaultValues}
      schema={editPostSchema}
      pending={pending}
      onClose={onClose}
      onSubmit={(data) => {
        if (!editingPost) return
        onSubmit(editingPost.id, data.title, data.content || null)
      }}
    >
      {(form) => (
        <>
          <Field
            label="Title"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />
          <TextArea
            label="Content"
            error={form.formState.errors.content?.message}
            {...form.register('content')}
          />
        </>
      )}
    </EditDialog>
  )
}
