import type { UseFormReturn } from 'react-hook-form'
import { Button, Field, Panel, TextArea } from '@/components/ui'
import type { CreatePostFormValues } from '@/validation/schemas'

type CreatePostFormProps = {
  form: UseFormReturn<CreatePostFormValues>
  canCreateOnBehalf: boolean
  isPending: boolean
  onSubmit: (data: CreatePostFormValues) => void
}

export function CreatePostForm({
  form,
  canCreateOnBehalf,
  isPending,
  onSubmit,
}: CreatePostFormProps) {
  return (
    <Panel
      title="Create post"
      description="Leave user ID blank to create as yourself."
    >
      <form className="form-grid" onSubmit={form.handleSubmit(onSubmit)}>
        <Field
          label="Title"
          error={form.formState.errors.title?.message}
          {...form.register('title')}
        />
        {canCreateOnBehalf ? (
          <Field
            label="On behalf of user ID"
            type="number"
            min={1}
            error={form.formState.errors.behalfUserId?.message}
            {...form.register('behalfUserId')}
          />
        ) : null}
        <div style={{ gridColumn: '1 / -1' }}>
          <TextArea
            label="Content"
            error={form.formState.errors.content?.message}
            {...form.register('content')}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Button variant="primary" disabled={isPending}>
            Create post
          </Button>
        </div>
      </form>
    </Panel>
  )
}
