# 5. Component Architecture & Design System

## 5.1 Component Classification

Components fall into two categories:

### Presentation (Dumb) Components — `src/components/ui.tsx`
- **Have no business logic.** They don't fetch data, don't read global state, don't know about APIs.
- **Accept props and render HTML.** Their only job is to apply consistent styling.
- **Examples:** `Button`, `Field`, `SelectField`, `TextArea`, `Panel`, `Badge`, `EmptyState`, `SkeletonRows`, `ConfirmDialog`.

### Container (Smart) Components — `src/pages/*.tsx`
- **Orchestrate the application.** They call hooks, trigger mutations, manage local form state.
- **Map data to presentation components.** They fetch users from the API and render them inside `<Panel>` and `<table>`.
- **Examples:** `UsersPage`, `RolesPage`, `PostsPage`, `AuthPage`.

### Layout Components — `AppShell.tsx`, `ProtectedRoute.tsx`
- **Control page structure.** Sidebar, topbar, route mounting.
- **Handle cross-cutting concerns.** Authentication gating, logout, theme toggling.

---

## 5.2 Presentation Components Reference

### Button
```tsx
<Button variant="primary" disabled={isPending}>Submit</Button>
<Button variant="danger" onClick={handleDelete}>Delete</Button>
<Button variant="ghost" onClick={handleCancel}>Cancel</Button>
<Button variant="secondary">Default</Button>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | `'secondary'` | Visual style |
| `...rest` | `ButtonHTMLAttributes` | — | All native button props |

CSS classes generated: `button button-{variant}`.

### Field (Input)
```tsx
<Field label="Email" value={email} type="email" required onChange={handleChange} />
```
Renders a `<label>` wrapping a `<span>` (label text) and an `<input>`. All native `InputHTMLAttributes` are forwarded.

### SelectField
```tsx
<SelectField label="Role" value={roleName} options={roleNames} onChange={setRoleName} />
```
Generic component (`SelectField<T extends string>`) that renders a `<select>` dropdown from a typed array of options.

### TextArea
```tsx
<TextArea label="Content" value={content} onChange={setContent} />
```
Renders a `<label>` + `<textarea>` pair. The `onChange` callback receives the string value directly (not the event).

### Panel
```tsx
<Panel title="Users" description="Backend user records." actions={<Button>Export</Button>}>
  {children}
</Panel>
```
A card-like container with a header section (title, description, optional action buttons) and a content body.

### Badge
```tsx
<Badge>admin</Badge>
```
A small inline tag used for role names, permission actions, and labels.

### EmptyState
```tsx
<EmptyState>No users returned.</EmptyState>
```
Centered, muted text shown when a list has no items.

### SkeletonRows
```tsx
<SkeletonRows rows={4} />
```
Animated placeholder bars shown while data is loading. Uses a CSS `glitch-sweep` animation.

### ConfirmDialog
```tsx
<ConfirmDialog
  open={isOpen}
  title="Delete user"
  description="Delete admin@example.com?"
  confirmLabel="Delete"
  onConfirm={handleDelete}
  onClose={handleClose}
/>
```
A modal dialog for destructive action confirmation. Clicking the backdrop closes it.

---

## 5.3 The useConfirmAction Hook

**File:** `src/hooks/useConfirmAction.tsx`

This hook abstracts the state management for confirmation dialogs. Instead of each page managing its own `open`/`close`/`action` state, the hook encapsulates it:

```tsx
const { confirm, confirmDialog } = useConfirmAction();

// Trigger a confirmation
<Button onClick={() => confirm({
  title: "Delete user",
  description: `Delete ${user.email}?`,
  confirmLabel: "Delete",
  onConfirm: () => deleteUser.mutate(user.id),
})}>
  Delete
</Button>

// Render the dialog (place at the bottom of the page JSX)
{confirmDialog}
```

Every page that performs destructive operations (delete, revoke) follows this exact pattern.

---

## 5.4 Theme System

### How it works
**File:** `src/hooks/useTheme.ts`

1. On mount, reads the saved theme from `localStorage` (key: `theme`).
2. Falls back to the OS preference via `window.matchMedia("(prefers-color-scheme: dark)")`.
3. Toggles a `dark` CSS class on `<html>` (`document.documentElement`).

**File:** `src/index.css`

The entire design system is built with CSS custom properties (variables):
```css
:root {
  --bg: #e5e5e5;
  --surface: #ffffff;
  --text: #050505;
  --accent: #10b981;
  /* ... */
}

.dark {
  --bg: #050505;
  --surface: #111111;
  --text: #f4f4f5;
  --accent: #10b981;
  /* ... */
}
```

Adding the `dark` class to `<html>` swaps all CSS variables at once. Every component that uses `var(--bg)` or `var(--surface)` automatically adopts the dark palette without any JS logic.

### The Brutalist Design Language
The CSS uses a **Neo-Brutalist** aesthetic:
- `--radius: 0px` — no rounded corners.
- `--hard-shadow: 4px 4px 0px 0px var(--shadow-color)` — offset drop shadows.
- `--border-width: 2px` — thick, visible borders.
- Fonts: `Unbounded` (headings), `JetBrains Mono` (body/monospace).
- CRT scanline background texture on `body`.

---

## 5.5 CSS Layout Classes

| Class | Purpose | Used in |
|---|---|---|
| `.app-shell` | Two-column grid (sidebar + main) | `AppShell.tsx` |
| `.page-stack` | Single-column stacked sections | Most pages |
| `.page-grid` | Two-column grid for forms + tables side by side | `UsersPage.tsx` |
| `.form-grid` | Two-column form layout | Create forms |
| `.form-grid.compact` | Four-column form layout | Inline assignment forms |
| `.record-grid` | Auto-fit card grid | `RolesPage.tsx`, `PostsPage.tsx` |
| `.stats-grid` | Four-column stat cards | `DashboardPage.tsx` |
| `.table-wrap` | Overflow-x scrollable table container | Data tables |
| `.button-row` | Flex row for action buttons | Everywhere |
| `.badge-list` | Flex row for badge tags | Role lists |

---

## 5.6 The Page Component Pattern

Every page in the application follows a consistent structure. Here is the template:

```tsx
export function ExamplePage() {
  // 1. Hooks setup
  const queryClient = useQueryClient();
  const { can } = useCapabilities();
  const { confirm, confirmDialog } = useConfirmAction();
  const [page, setPage] = useState(1);

  // 2. Data fetching
  const items = useQuery({
    queryKey: queryKeys.items(page),
    queryFn: () => itemsApi.list({ page, pageSize: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  // 3. Local form state
  const [name, setName] = useState("");

  // 4. Cache invalidation helpers
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["items"] });

  // 5. Mutations
  const createItem = useMutation({
    mutationFn: itemsApi.create,
    onSuccess: () => { toast.success("Created"); setName(""); invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  // 6. JSX: capability-gated forms, then data table
  return (
    <div className="page-stack">
      {can("items.create") ? (
        <Panel title="Create item">
          <form className="form-grid" onSubmit={...}>
            <Field label="Name" value={name} onChange={...} />
            <Button variant="primary" disabled={createItem.isPending}>Create</Button>
          </form>
        </Panel>
      ) : null}

      <Panel title="Items">
        {items.isLoading ? <SkeletonRows /> : null}
        {items.data?.items.length ? (
          <div className="table-wrap">
            <table>...</table>
            <PaginationControls pagination={items.data.pagination} onPageChange={setPage} />
          </div>
        ) : !items.isLoading ? (
          <EmptyState>No items returned.</EmptyState>
        ) : null}
      </Panel>
      {confirmDialog}
    </div>
  );
}
```
