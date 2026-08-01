# 05 — Responsive Design Overhaul Plan

> **Goal**: Fix all responsive layout issues — sidebar toggle, sidebar independent scroll, table column compression, and responsive text sizing — across mobile, tablet, and desktop breakpoints.

---

## Table of Contents

1. [Issue #1 — Mobile & Tablet Breakpoints](#issue-1--mobile--tablet-breakpoints)
2. [Issue #2 — Sidebar Toggle](#issue-2--sidebar-toggle)
3. [Issue #3 — Sidebar Independent Scroll](#issue-3--sidebar-independent-scroll)
4. [Issue #4 — Table Column Compression](#issue-4--table-column-compression)
5. [Issue #5 — Responsive Text Sizing](#issue-5--responsive-text-sizing)
6. [File-by-File Change Summary](#file-by-file-change-summary)
7. [Edge Cases Checklist](#edge-cases-checklist)

---

## Issue #1 — Mobile & Tablet Breakpoints

### Q: What is the current breakpoint situation?

The CSS in `index.css` (lines 956–997) has only two breakpoints:

```css
@media (max-width: 1024px) { /* auth-panel, page-grid → single column */ }
@media (max-width: 768px)  { /* sidebar hidden, stats 2-col, forms 1-col */ }
```

**Problems:**
- No tablet-specific layout between 768px–1024px.
- At `≤768px` the sidebar is `display: none` with no way to show it again.
- No breakpoint handles the 480px–768px range (large phones / small tablets).
- `stats-grid` jumps from 4 columns to 2 columns — there's no single-column fallback for very small screens.

### Q: What breakpoints will we use?

| Token | Width | Targets |
|---|---|---|
| `sm` | `≤480px` | Small phones |
| `md` | `≤768px` | Large phones / small tablets |
| `lg` | `≤1024px` | Tablets / narrow browser windows |
| `xl` | `>1024px` | Desktop (default, no media query needed) |

### Q: What changes at each breakpoint?

**`≤1024px` (lg) — already exists, extend it:**
- `auth-panel` → single column ✅ (already done)
- `page-grid` → single column ✅ (already done)
- `stats-grid` → `repeat(2, 1fr)` (move from 768px breakpoint up to here)
- `form-grid.compact` → `repeat(2, 1fr)` instead of `repeat(4, 1fr)`
- Sidebar stays visible on screen (desktop sidebar mode)

**`≤768px` (md) — rework:**
- Sidebar becomes an **overlay drawer** (off-screen left, slides in on toggle).
- A **hamburger button** appears in the topbar.
- `form-grid`, `form-grid.compact` → single column.
- `stats-grid` → `repeat(2, 1fr)`.
- Reduce page padding from `32px` → `16px`.
- Topbar padding reduces from `32px` → `16px`.

**`≤480px` (sm) — new:**
- `stats-grid` → single column.
- `stat-card strong` (the big number) → smaller font.
- `session-box` in topbar → hide email/role text, show only logout + theme buttons.
- `button` → full-width where inside `form-grid` or `panel-actions`.
- `panel` padding `32px` → `16px`.

### Q: Why not use a CSS framework for this?

The project uses vanilla CSS with CSS custom properties (brutalist design system). Adding a framework would conflict. We keep it vanilla and add targeted `@media` rules.

### Q: Exact CSS changes for breakpoints?

**In `index.css`, replace the entire `/* Responsive */` section (lines 956–997) with:**

```css
/* ═══════════════ Responsive ═══════════════ */

/* --- Tablet (≤1024px) --- */
@media (max-width: 1024px) {
  .auth-panel {
    grid-template-columns: 1fr;
  }

  .auth-copy {
    border-right: 0;
    border-bottom: var(--border-width) solid var(--border);
  }

  .page-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .form-grid.compact {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* --- Mobile (≤768px) --- */
@media (max-width: 768px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  /* Sidebar becomes overlay drawer */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 100;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .sidebar-toggle {
    display: flex;
  }

  .form-grid,
  .form-grid.compact {
    grid-template-columns: 1fr;
  }

  .topbar {
    padding: 0 16px;
  }

  .page-stack,
  .page-grid {
    padding: 16px;
  }
}

/* --- Small phone (≤480px) --- */
@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card strong {
    font-size: 2rem;
  }

  .session-box .session-info {
    display: none;
  }

  .panel {
    padding: 16px;
  }

  .topbar h1 {
    font-size: 1rem;
  }

  .topbar .eyebrow {
    display: none;
  }
}
```

**Default (desktop) additions — add these BEFORE the responsive section:**

```css
/* These are defaults that get overridden in responsive breakpoints */
.sidebar-backdrop {
  display: none;
}

.sidebar-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: var(--border-width) solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
```

---

## Issue #2 — Sidebar Toggle

### Q: What is the current behavior?

`AppShell.tsx` renders the sidebar as a static `<aside>`. At `≤768px`, the CSS sets `.sidebar { display: none }` — the sidebar vanishes entirely. There is **no toggle button**, **no hamburger icon**, and **no state** to control open/close.

### Q: What will the new behavior be?

- **Desktop (>768px):** Sidebar is always visible in the grid layout. No toggle button shown.
- **Mobile (≤768px):** Sidebar is off-screen left (`transform: translateX(-100%)`). A **hamburger button** (☰) appears in the topbar. Clicking it:
  1. Adds class `open` to `.sidebar` → slides it in.
  2. Shows a dark backdrop behind the sidebar.
  3. Clicking the backdrop or any nav link closes the sidebar.

### Q: What React state do we need?

One boolean: `sidebarOpen`. Managed in `AppShell.tsx`.

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);
```

### Q: What JSX changes in AppShell.tsx?

**1. Add a hamburger button in the topbar (before the `<div>` with eyebrow/h1):**

```tsx
<header className="topbar">
  <button
    type="button"
    className="sidebar-toggle"
    onClick={() => setSidebarOpen(true)}
    aria-label="Open navigation"
  >
    <Menu size={24} />
  </button>
  <div>
    <span className="eyebrow">Authenticated workspace</span>
    <h1>{access?.user.fullname ?? "RoleControl operator"}</h1>
  </div>
  {/* ... session-box ... */}
</header>
```

Import `Menu` from `lucide-react`.

**2. Add `open` class to sidebar conditionally:**

```tsx
<aside className={cx("sidebar", sidebarOpen && "open")}>
```

**3. Add a backdrop element right after `</aside>` (inside `.app-shell`):**

```tsx
{sidebarOpen && (
  <div
    className="sidebar-backdrop"
    onClick={() => setSidebarOpen(false)}
    aria-hidden="true"
  />
)}
```

**4. Close sidebar on nav link click — wrap NavLink `onClick`:**

Every `<NavLink>` and `<button>` for nav accordion should also close the sidebar. The cleanest approach: wrap the `<nav>` click handler:

```tsx
<nav className="nav-list" onClick={() => setSidebarOpen(false)}>
```

This works because nav links and accordion triggers are children. Clicking any link will bubble up and close the sidebar. The accordion trigger should NOT close the sidebar — only actual NavLinks should. So instead, add `onClick={() => setSidebarOpen(false)}` on each `<NavLink>` individually, not on `<nav>`.

**Corrected approach — add to each `<NavLink>`:**

```tsx
<NavLink
  key={child.to}
  to={child.to}
  className="nav-sub-item"
  onClick={() => setSidebarOpen(false)}
>
```

And the top-level NavLink:

```tsx
<NavLink
  key={item.to}
  to={item.to}
  className="nav-item"
  onClick={() => setSidebarOpen(false)}
>
```

### Q: What import needs to be added?

```tsx
import { ChevronDown, LogOut, Menu } from "lucide-react";
```

### Q: Edge case — what if the user resizes from mobile to desktop while sidebar is open?

The CSS handles this naturally: at `>768px`, `.sidebar-toggle` is `display: none` and `.sidebar` reverts to its grid-based position (no `position: fixed`, no `transform`). The `open` class has no effect because the fixed/transform rules only apply inside the `≤768px` media query. The backdrop is also `display: none` at desktop. No extra JS needed.

### Q: Edge case — body scroll when sidebar drawer is open?

When the sidebar overlay is open on mobile, the user should not be able to scroll the main content behind it. Add this CSS:

```css
body.sidebar-open {
  overflow: hidden;
}
```

And in `AppShell.tsx`, use a `useEffect`:

```tsx
useEffect(() => {
  document.body.classList.toggle("sidebar-open", sidebarOpen);
  return () => document.body.classList.remove("sidebar-open");
}, [sidebarOpen]);
```

---

## Issue #3 — Sidebar Independent Scroll

### Q: What is the current problem?

The sidebar CSS (lines 337–348):

```css
.sidebar {
  position: sticky;
  top: 0;
  align-self: stretch;
  min-height: 100vh;
  height: max-content;  /* ← THIS IS THE BUG */
  ...
}
```

`height: max-content` makes the sidebar as tall as its content. When the nav list is longer than the viewport, the sidebar element itself exceeds `100vh`. Because it's `position: sticky; top: 0`, the browser pins the top — but the bottom extends below the viewport. You can only see the bottom nav items by scrolling the entire page to the end (when main content is also long). The sidebar does NOT scroll independently.

### Q: What is the fix?

Replace the sidebar height/scroll rules:

```css
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;           /* Fixed to viewport height, not content height */
  display: flex;
  flex-direction: column;
  border-right: var(--border-width) solid var(--border);
  background: var(--surface-strong);
  z-index: 10;
  overflow: hidden;         /* Prevent sidebar itself from overflowing */
}
```

Remove `align-self: stretch`, `min-height: 100vh`, and `height: max-content`.

Then make `.nav-list` scrollable:

```css
.nav-list {
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 8px;
  flex: 1;                  /* Fill remaining space below .brand */
  overflow-y: auto;         /* Scroll when nav items overflow */
  min-height: 0;            /* Required for flex children to shrink below content size */
}
```

Add `flex: 1; overflow-y: auto; min-height: 0;` to `.nav-list`.

### Q: Why `min-height: 0` on `.nav-list`?

Flexbox children default to `min-height: auto`, which prevents them from shrinking below their content size. Without `min-height: 0`, `overflow-y: auto` has no effect because the element will always grow to fit its content.

### Q: What about the mobile drawer sidebar?

At `≤768px` the sidebar becomes `position: fixed` with `top: 0; bottom: 0` — this effectively gives it `height: 100vh` already. The same `overflow-y: auto` on `.nav-list` applies and handles scroll within the drawer. No extra rules needed.

### Q: Edge case — custom scrollbar styling?

Add subtle scrollbar styling to match the brutalist theme:

```css
.nav-list::-webkit-scrollbar {
  width: 4px;
}

.nav-list::-webkit-scrollbar-track {
  background: transparent;
}

.nav-list::-webkit-scrollbar-thumb {
  background: var(--muted);
}
```

### Q: Edge case — keyboard navigation inside scrollable nav?

When the user tabs through nav items, the browser will auto-scroll the focused item into view within the scrollable `.nav-list`. No extra JS is needed for this — native browser behavior handles it.

---

## Issue #4 — Table Column Compression

### Q: What is the current problem?

Tables use `width: 100%` and `.table-wrap` has `overflow-x: auto`. However, the `<table>` has no `min-width`, so when the viewport shrinks, columns compress and text wraps/overlaps instead of triggering horizontal scroll.

**Affected pages and their column counts:**

| Page | Columns | Severity |
|---|---|---|
| `AuditLogsPage` | 9 (ID, Actor, Action, Resource, Resource ID, Old Values, New Values, Metadata, Date) | **Critical** — 3 JSON preview columns |
| `SessionsPage` | 7 (ID, User ID, User Name, Device, Status, Expires At, Created At) | High |
| `UsersPage` | 5–6 (ID, Name, Email, Roles, Created, Actions?) | Medium |
| `PermissionsPage` | 4–5 (ID, Action, Resource, Description, Actions?) | Low |
| `RolePermissionsPage` | 3 (Action, Resource, Roles) | Low |
| `MigrationsPage` | 3 (ID, Name, Run On) | Low |

### Q: What is the fix?

Set `min-width` on `<table>` elements so they maintain readable column widths and trigger horizontal scroll on `.table-wrap` instead of compressing.

**CSS approach — add to `index.css`:**

```css
table {
  width: 100%;
  min-width: 700px;   /* Default minimum for most tables */
  border-collapse: collapse;
}
```

**For tables with many columns (Audit Logs — 9 cols, 3 JSON previews), use a CSS class:**

```css
table.table-wide {
  min-width: 1100px;
}
```

Apply `className="table-wide"` to the `<table>` in `AuditLogsPage`.

**For tables with fewer columns (3 cols like Migrations, RolePermissions), use:**

```css
table.table-narrow {
  min-width: 480px;
}
```

### Q: Which files need className additions?

| File | Table Element | Add Class |
|---|---|---|
| `AuditLogsPage.tsx` | `<table>` (line 84) | `className="table-wide"` |
| `SessionsPage.tsx` | `<table>` (line 378) | _(none — uses default 700px)_ |
| `UsersPage.tsx` | `<table>` (line 241) | _(none — uses default 700px)_ |
| `PermissionsPage.tsx` | `<table>` (line 103) | _(none — uses default 700px)_ |
| `RolePermissionsPage.tsx` | `<table>` (line 133) | `className="table-narrow"` |
| `MigrationsPage.tsx` | `<table>` (line 41) | `className="table-narrow"` |

### Q: Edge case — what about the pagination bar inside `.table-wrap`?

`PaginationControls` renders inside `.table-wrap` in some pages. The `.pagination-bar` uses `display: flex` and is not a `<table>`, so it won't be affected by `min-width` on `<table>`. It will scroll with the table wrapper naturally. No issue here.

### Q: Edge case — what about `.json-preview` inside table cells?

`.json-preview` already has `max-width: 300px; max-height: 120px; overflow: auto`. This is fine — the preview box has its own scroll. The `min-width: 1100px` on `.table-wide` ensures the table itself doesn't compress, giving each cell enough room.

### Q: Edge case — touch scrolling on mobile?

`.table-wrap { overflow-x: auto }` supports touch-swipe scrolling natively on mobile browsers. Add `-webkit-overflow-scrolling: touch` for older iOS:

```css
.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

---

## Issue #5 — Responsive Text Sizing

### Q: What is the current problem?

All font sizes are static `rem` values. When the screen shrinks, text stays the same size, consuming proportionally more space. Key offenders:

- `stat-card strong`: `3rem` (the big dashboard number)
- `.topbar h1`: `1.5rem`
- `.panel h2, .record-card h3`: `1.5rem`
- `.button`: `0.85rem` (fine, but the `min-height: 48px` + padding takes space)
- `.auth-copy h1`: already uses `clamp()` ✅
- Base body text: no responsive scaling at all

### Q: What is the fix?

Use `clamp()` for text that appears in data-heavy contexts. `clamp(min, preferred, max)` scales smoothly without breakpoints.

**CSS changes — modify existing rules in `index.css`:**

```css
/* Base font size — add to :root */
:root {
  font-size: clamp(13px, 1.4vw, 16px);  /* scales base rem unit */
}

/* Topbar heading */
.topbar h1 {
  font-size: clamp(1rem, 2.5vw, 1.5rem);
}

/* Panel/card headings */
.panel h2, .record-card h3 {
  font-size: clamp(1.1rem, 2.5vw, 1.5rem);
}

/* Dashboard stat number */
.stat-card strong {
  font-size: clamp(1.8rem, 5vw, 3rem);
}

/* Table cells — slightly smaller on narrow screens */
th, td {
  padding: clamp(8px, 1.5vw, 16px) clamp(10px, 2vw, 20px);
  font-size: clamp(0.75rem, 1.2vw, 0.95rem);
}

/* Table headers */
th {
  font-size: clamp(0.7rem, 1vw, 0.8rem);
}
```

### Q: Why `clamp()` on `:root font-size` instead of per-element?

Changing the root `font-size` scales every `rem` value in the entire app. This gives us global responsive scaling for free. Elements that need to scale differently (headings, stat numbers) get their own `clamp()` override.

### Q: Edge case — won't changing root font-size break component spacing?

All spacing uses `px` values (e.g., `padding: 24px`, `gap: 8px`), not `rem`. So spacing is unaffected. Only `font-size` values using `rem` will scale. This is safe.

### Q: Edge case — minimum readability?

The `clamp()` minimum of `13px` on `:root` ensures text never goes below 13px effective size. For table cells, the minimum is `0.75rem` × `13px` ≈ `9.75px` — still readable for monospace data. If this feels too small, bump the table cell min to `0.8rem`.

### Q: Edge case — print styling?

Not applicable for this app (admin dashboard), but `clamp()` with `vw` units will resolve to the page width when printing. This is acceptable behavior.

---

## File-by-File Change Summary

### `src/index.css` — CSS (largest change)

| Section | What Changes | Lines |
|---|---|---|
| `:root` | Add `font-size: clamp(13px, 1.4vw, 16px)` | 4 |
| `.sidebar` | Remove `align-self`, `min-height`, `height: max-content`. Add `height: 100vh; overflow: hidden` | 337–348 |
| `.nav-list` | Add `flex: 1; overflow-y: auto; min-height: 0` | 388–393 |
| `.nav-list` scrollbar | Add `::-webkit-scrollbar` styles (new block) | after 393 |
| `.sidebar-backdrop` | New rule (default `display: none`) | new |
| `.sidebar-toggle` | New rule (default `display: none`) | new |
| `body.sidebar-open` | New rule (`overflow: hidden`) | new |
| `.topbar h1` | Change to `clamp()` | 494–496 |
| `.panel h2, .record-card h3` | Change to `clamp()` | 610–612 |
| `.stat-card strong` | Change to `clamp()` | 585–590 |
| `th, td` | Add `clamp()` for padding and font-size | 778–784 |
| `table` | Add `min-width: 700px` | 773–776 |
| `table.table-wide` | New rule (`min-width: 1100px`) | new |
| `table.table-narrow` | New rule (`min-width: 480px`) | new |
| `.table-wrap` | Add `-webkit-overflow-scrolling: touch` | 766–771 |
| `@media ≤1024px` | Add `stats-grid`, `form-grid.compact` rules | 957+ |
| `@media ≤768px` | Rework: sidebar overlay, toggle show, padding reduction | 972+ |
| `@media ≤480px` | New: stats 1-col, smaller stat numbers, hide session info | new |

### `src/components/AppShell.tsx` — React

| Change | Detail |
|---|---|
| New import | `Menu` from `lucide-react` |
| New state | `const [sidebarOpen, setSidebarOpen] = useState(false)` |
| New `useEffect` | Toggle `body.sidebar-open` class |
| Sidebar className | `cx("sidebar", sidebarOpen && "open")` |
| New element | Hamburger `<button className="sidebar-toggle">` in topbar |
| New element | `<div className="sidebar-backdrop">` after `</aside>` |
| NavLink onClick | Add `onClick={() => setSidebarOpen(false)}` to all NavLinks |
| Session box | Wrap email/role `<div>` in `<div className="session-info">` for hiding on small screens |

### `src/pages/AuditLogsPage.tsx` — JSX

| Change | Detail |
|---|---|
| Line 84 | `<table>` → `<table className="table-wide">` |

### `src/pages/RolePermissionsPage.tsx` — JSX

| Change | Detail |
|---|---|
| Line 133 | `<table>` → `<table className="table-narrow">` |

### `src/pages/MigrationsPage.tsx` — JSX

| Change | Detail |
|---|---|
| Line 41 | `<table>` → `<table className="table-narrow">` |

---

## Edge Cases Checklist

| # | Edge Case | Handled By |
|---|---|---|
| 1 | Sidebar has more nav items than viewport height → needs independent scroll | `height: 100vh` + `overflow-y: auto` on `.nav-list` |
| 2 | Mobile sidebar open → main page should not scroll behind it | `body.sidebar-open { overflow: hidden }` |
| 3 | Resize from mobile to desktop while sidebar is open → no visual glitch | Media query scoping: `position: fixed` and `transform` only in `≤768px` block |
| 4 | Clicking nav link on mobile → sidebar should auto-close | `onClick={() => setSidebarOpen(false)}` on every NavLink |
| 5 | Clicking accordion trigger → sidebar should NOT close (only expand/collapse group) | onClick only on NavLink elements, not on accordion buttons |
| 6 | Table with 9 columns on tablet → should scroll horizontally, not compress | `table { min-width: 700px }` and `.table-wide { min-width: 1100px }` |
| 7 | Touch scrolling on tables on mobile | `-webkit-overflow-scrolling: touch` on `.table-wrap` |
| 8 | Pagination bar inside `.table-wrap` → should not be affected by table min-width | Pagination is a `<div>`, not inside `<table>` — unaffected |
| 9 | JSON preview columns in audit logs → should not expand beyond their max-width | `.json-preview` already has `max-width: 300px; overflow: auto` |
| 10 | Root font-size scaling → should not break spacing | All spacing uses `px`, only `rem` font-sizes scale |
| 11 | Minimum text readability at smallest viewport | `clamp()` minimums: root 13px, table cells 0.75rem |
| 12 | Keyboard navigation in scrollable sidebar nav | Browser auto-scrolls focused element into view natively |
| 13 | Session box text too long on small screens | Hide `.session-info` at `≤480px`, keep only buttons |
| 14 | Topbar eyebrow label wasting space on small screens | Hide `.eyebrow` at `≤480px` |
| 15 | Stat card numbers too large on phone | `clamp(1.8rem, 5vw, 3rem)` scales down smoothly |
| 16 | `form-grid.compact` has 4 columns → unusable on tablet | Drops to 2-col at `≤1024px`, 1-col at `≤768px` |
| 17 | Sidebar backdrop z-index vs topbar z-index | Backdrop `z-index: 99`, sidebar `z-index: 100`, topbar `z-index: 5` — correct stacking |
| 18 | Dark mode + sidebar backdrop color | `rgba(0, 0, 0, 0.5)` works for both light and dark modes |

---

## Implementation Order

1. **CSS first** — All `index.css` changes (sidebar scroll fix, new classes, responsive sections, text clamp).
2. **AppShell.tsx** — Sidebar toggle state, hamburger button, backdrop, NavLink onClick handlers, session-info wrapper.
3. **Page files** — Add `table-wide` / `table-narrow` classes to specific tables.
4. **Test** — Verify at 1024px, 768px, 480px, and 375px (iPhone SE) widths using browser DevTools responsive mode.
