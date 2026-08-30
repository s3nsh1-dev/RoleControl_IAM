import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthState = {
  isAuthenticated: boolean
  setAuthenticated: (isAuthenticated?: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      setAuthenticated: (isAuthenticated = true) => set({ isAuthenticated }),
      clearAuth: () => set({ isAuthenticated: false }),
    }),
    {
      name: 'rbac-auth-session',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
