import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { PostsPage } from '../PostsPage'
import {
  capabilities,
  createMockAuthMe,
  createMockPost,
  createPaginationMeta,
} from '@/test/fixtures'
import { apiError, ok } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { render, screen, userEvent, waitFor, within } from '@/test/test-utils'

function mockAuthWithPosts(...items: Parameters<typeof capabilities>) {
  server.use(
    http.get('/api/auth/me', () =>
      ok(
        createMockAuthMe({
          capabilities: capabilities(...items),
        }),
      ),
    ),
  )
}

function mockPostsList(posts = [createMockPost({ title: 'First post' })]) {
  server.use(
    http.get('/api/posts', () =>
      ok({ posts, pagination: createPaginationMeta(posts.length) }),
    ),
  )
}

describe('PostsPage', () => {
  it('renders posts returned by the API', async () => {
    mockAuthWithPosts('posts.view', 'posts.update', 'posts.delete')
    mockPostsList([createMockPost({ title: 'First post', content: 'Hello' })])

    render(<PostsPage />)

    expect(await screen.findByRole('heading', { name: 'First post' })).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows empty and error states', async () => {
    mockAuthWithPosts('posts.view')
    mockPostsList([])

    const { unmount } = render(<PostsPage />)

    expect(await screen.findByText('No posts returned.')).toBeInTheDocument()
    unmount()

    mockAuthWithPosts('posts.view')
    server.use(http.get('/api/posts', () => apiError(500, 'Posts failed')))

    render(<PostsPage />)

    expect(await screen.findByText('Unable to load posts')).toBeInTheDocument()
    expect(screen.getByText('Posts failed')).toBeInTheDocument()
  })

  it('hides and shows create controls based on capabilities', async () => {
    mockAuthWithPosts('posts.view')
    mockPostsList([])

    const { unmount } = render(<PostsPage />)

    expect(await screen.findByText('No posts returned.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Create post' })).not.toBeInTheDocument()
    unmount()

    mockAuthWithPosts('posts.view', 'posts.create')
    mockPostsList([])

    render(<PostsPage />)

    expect(await screen.findByRole('heading', { name: 'Create post' })).toBeInTheDocument()
    expect(screen.queryByLabelText('On behalf of user ID')).not.toBeInTheDocument()
  })

  it('creates a post and supports create-on-behalf when permitted', async () => {
    const user = userEvent.setup()
    mockAuthWithPosts('posts.view', 'posts.create', 'posts.createOnBehalf')
    mockPostsList([])
    server.use(
      http.post('/api/posts/on-behalf/:userId', ({ params }) =>
        ok({
          post: createMockPost({
            title: `Delegated ${params.userId}`,
            behalf_of: Number(params.userId),
          }),
        }),
      ),
    )

    render(<PostsPage />)

    expect(await screen.findByLabelText('On behalf of user ID')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Title'), 'Delegated post')
    await user.type(screen.getByLabelText('On behalf of user ID'), '42')
    await user.type(screen.getByLabelText('Content'), 'Created for another user')
    await user.click(screen.getByRole('button', { name: 'Create post' }))

    expect(await screen.findByText('Post created on behalf of user')).toBeInTheDocument()
  })

  it('validates post title length', async () => {
    const user = userEvent.setup()
    mockAuthWithPosts('posts.view', 'posts.create')
    mockPostsList([])

    render(<PostsPage />)

    await user.type(await screen.findByLabelText('Title'), 'No')
    await user.tab()

    expect(await screen.findByText('Title must be at least 3 characters')).toBeInTheDocument()
  })

  it('edits and deletes a post through visible actions', async () => {
    const user = userEvent.setup()
    const post = createMockPost({ id: 10, title: 'Editable post' })
    mockAuthWithPosts('posts.view', 'posts.update', 'posts.delete')
    mockPostsList([post])
    server.use(
      http.put('/api/posts/:id', () =>
        ok({ post: createMockPost({ id: 10, title: 'Updated post' }) }),
      ),
      http.delete('/api/posts/:id', () => ok({ post })),
    )

    render(<PostsPage />)

    expect(await screen.findByRole('heading', { name: 'Editable post' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Edit post' })).toBeInTheDocument()
    const titleInput = within(dialog).getByLabelText('Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated post')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Post updated')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete post')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Post deleted')).toBeInTheDocument()
    })
  })
})
