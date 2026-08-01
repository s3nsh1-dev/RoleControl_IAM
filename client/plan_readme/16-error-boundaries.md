# 7. Error Boundaries

## 7.1 The "What, Why, Where, and When" of Error Boundaries

### What is an Error Boundary?
In React, if a JavaScript error occurs during rendering, lifecycle methods, or inside a hook, React will completely unmount the entire component tree. This results in the infamous "white screen of death."

An **Error Boundary** is a specialized React component that catches these JavaScript errors anywhere in its child component tree, logs the errors, and displays a graceful **fallback UI** instead of crashing the whole application.

### Why do we need them?
1. **User Experience:** A blank white screen is unacceptable for a production application. Error Boundaries allow you to show a friendly "Something went wrong" message, often with a "Try again" button.
2. **System Resilience:** If one isolated feature (like a chart on the Dashboard) throws an error, the rest of the application (like the navigation sidebar) should remain fully functional.
3. **Error Reporting:** Error boundaries provide a specific lifecycle hook (`componentDidCatch` or `onError`) where you can send the crash details to a logging service (like Sentry or Datadog).

> **Important Distinction:** Error Boundaries **DO NOT** catch API errors (like 404s or 500s from Axios). API errors are handled by React Query and Axios interceptors. Error boundaries only catch **React rendering/execution bugs** (e.g., trying to read `user.fullname.first` when `fullname` is undefined).

### When should you use them?
You should implement Error Boundaries **before shipping to production**. During development, Vite overlays the error on the screen. In production, unhandled errors silently kill the app. 

### Where should they be placed?
Error boundaries are typically placed at strategic structural points in the DOM tree:
1. **Root Level:** The absolute top level (catches everything, last line of defense).
2. **Layout Level:** Around page content (so if a page crashes, the sidebar/navigation still works).
3. **Widget Level:** Around complex, failure-prone components (like a heavy data grid or third-party chart).

---

## 7.2 Implementation Plan for This App

To implement Error Boundaries in RoleControl IAM, we will use the industry-standard `react-error-boundary` package. It provides a modern, hook-friendly API, preventing us from having to write legacy React Class Components.

### Step 1: Install the dependency
```bash
pnpm add react-error-boundary
```

### Step 2: Create the Fallback UI Component
We will create a new presentation component in `src/components/ui.tsx` called `ErrorFallback`.

```tsx
// src/components/ui.tsx
import { FallbackProps } from 'react-error-boundary';

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="empty-state" style={{ borderColor: 'var(--danger)' }}>
      <h3 style={{ color: 'var(--danger)' }}>Application Error</h3>
      <p style={{ fontFamily: 'monospace', margin: '16px 0' }}>{error.message}</p>
      <Button variant="secondary" onClick={resetErrorBoundary}>
        Reload Component
      </Button>
    </div>
  );
}
```

### Step 3: Implement at the Root Level (Last Line of Defense)
If the application fails to boot entirely (e.g., a routing failure or provider crash), we need a root boundary. We'll wrap the application in `src/main.tsx`.

```tsx
// src/main.tsx
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './components/ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster richColors closeButton position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
```

### Step 4: Implement at the Page Level (Graceful Degradation)
If a specific page (like `UsersPage`) crashes, we **do not** want the user to lose access to the sidebar navigation. We want the sidebar to stay visible, and only the main content area to show the error.

We will wrap the `<Routes>` inside `src/components/AppShell.tsx`:

```tsx
// src/components/AppShell.tsx
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ui';

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">...</aside>
      <main className="main">
        <header className="topbar">...</header>
        
        {/* If a page crashes, the error stays confined here */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            {/* ... */}
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
```

### Step 5: Handling Query Resets (Optional but recommended)
When the user clicks "Reload Component" in the error fallback, we might also want to clear bad data from the React Query cache.

```tsx
// Example of how AppShell boundary might look:
<ErrorBoundary 
  FallbackComponent={ErrorFallback}
  onReset={() => {
    // Reset React Query cache on retry
    queryClient.clear();
  }}
>
```

## Summary of the Strategy
By implementing boundaries at the **Root** and **Page** levels, we ensure that:
1. The user never sees a blank white screen.
2. An error in `RolesPage` won't crash the navigation sidebar, allowing the user to seamlessly click away to `UsersPage`.
3. We have standardized UI (`ErrorFallback`) for presenting technical errors safely to the operator.
