# 2. State Management

## 2.1 The Three-Layer State Model

This codebase explicitly separates state into three layers. Understanding which layer a piece of data belongs to is the single most important mental model for working in this project.

| Layer | What it holds | Technology | Lifetime |
|---|---|---|---|
| **Server State** | Data owned by the backend (users, roles, posts) | React Query | Cached, background-synced |
| **Global Client State** | Frontend-only flags shared across components | Zustand | Persisted in localStorage |
| **Local UI State** | Ephemeral per-component data (form inputs, toggles) | React `useState` | Destroyed on unmount |

---

## 2.2 Server State — TanStack React Query

### What it is
React Query treats the backend as the **source of truth**. The frontend holds a temporary, cached copy of server data and keeps it synchronized via background refetching.

### Where it is configured
**`src/main.tsx`** — The `QueryClient` is created here with global defaults:
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,        // retry failed requests once
      staleTime: 20_000, // data is "fresh" for 20 seconds
    },
  },
});
```

### How queries work (reading data)
Every page uses `useQuery` to declaratively fetch data. You never write `useEffect(() => fetch(...))`.

```ts
// src/pages/UsersPage.tsx
const users = useQuery({
  queryKey: queryKeys.users(page),                          // cache key
  queryFn: () => usersApi.list({ page, pageSize: 20 }),     // how to fetch
  placeholderData: keepPreviousData,                        // show old page while loading new
});
```

**Key concepts:**
- **`queryKey`**: A unique array that identifies this piece of cached data. Changing the key (e.g., changing `page`) triggers a new fetch.
- **`queryFn`**: The function that actually calls the API.
- **`placeholderData: keepPreviousData`**: Prevents the UI from showing a loading spinner when paginating. The old page stays visible until the new page loads.
- **`staleTime`**: If a query was fetched less than 20 seconds ago, React Query serves it from cache without hitting the network.

### How mutations work (writing data)
All create/update/delete operations use `useMutation`:

```ts
const createUser = useMutation({
  mutationFn: usersApi.create,
  onSuccess: () => {
    toast.success("User created");
    queryClient.invalidateQueries({ queryKey: ["users"] }); // refetch the user list
  },
  onError: (error) => toast.error(error.message),
});
```

**The invalidation pattern** is critical: after a successful mutation, we invalidate the relevant query keys so React Query refetches the latest data from the server. This ensures the UI always reflects the current backend state without manual state synchronization.

### Centralized query keys
All query keys are defined in **`src/constants.ts`** to prevent typos and ensure cache invalidation targets the correct data:
```ts
export const queryKeys = {
  authMe: ["auth", "me"] as const,
  users: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["users", { page, pageSize }] as const,
  roles: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["roles", { page, pageSize }] as const,
  // ...
};
```

---

## 2.3 Global Client State — Zustand

### What it is
Zustand is a minimalist global state manager. Unlike Redux, it requires no providers, no reducers, no action creators. You create a store with `create()` and consume it via a hook.

### Where it is used
**`src/store/auth.ts`** — The only Zustand store in the application:
```ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      setAuthenticated: (isAuthenticated = true) => set({ isAuthenticated }),
      clearAuth: () => set({ isAuthenticated: false }),
    }),
    {
      name: 'rbac-auth-session',          // localStorage key
      partialize: (state) => ({           // only persist this subset
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
```

### Why Zustand instead of React Context
React Context re-renders **every consumer** when the context value changes. With Zustand, components only re-render when the **specific slice** they subscribe to changes:
```ts
// This component ONLY re-renders when isAuthenticated changes
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
```

### The persist middleware
The `persist` middleware serializes the `isAuthenticated` flag to `localStorage` under the key `rbac-auth-session`. This solves the **"flash of login screen"** problem: when the user refreshes the page, the app can immediately check localStorage to decide whether to show the loading skeleton (while validating the session via `/auth/me`) or redirect to `/login`.

### Why the store only holds a boolean
The store deliberately does **not** hold user profile data, roles, or capabilities. That data is **server state** and belongs in React Query (via the `useAuthMe` hook). The Zustand store exists only as a fast synchronous gatekeeper.

---

## 2.4 Local UI State — React useState

### What it is
Standard React `useState` for data that is:
- Ephemeral (doesn't survive component unmount)
- Local to one component (no other component needs it)
- Not derived from the server

### Where it is used
Form inputs across all page components:
```ts
// src/pages/UsersPage.tsx
const [fullname, setFullname] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [roleName, setRoleName] = useState<RoleName>("user");
```

Pagination state:
```ts
const [page, setPage] = useState(1);
```

### Why not put form state in Zustand?
Putting every keystroke into a global store would cause unnecessary re-renders across the entire application. Form input values are private to the form component — no other component cares about the current contents of the "email" field.
