/* eslint-disable react-refresh/only-export-components */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { Toaster } from 'sonner'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

type WrapperOptions = {
  routerProps?: MemoryRouterProps
  queryClient?: QueryClient
}

export function createWrapper(options: WrapperOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient()

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter {...options.routerProps}>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & WrapperOptions,
) {
  const { routerProps, queryClient, ...renderOptions } = options ?? {}

  return render(ui, {
    wrapper: createWrapper({ routerProps, queryClient }),
    ...renderOptions,
  })
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export { renderWithProviders as render }
