import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
      retryOnMount: false,
      // Prevent failed cached queries from refetching just because a new component
      // mounts and observes the same query key. Example: an errored ["auth", "me"]
      // query should not refetch only because AppShell or a page remounts.
      // A component mounting creates an observer; that observer can trigger a
      // refetch of the existing cached query unless retry-on-mount is disabled.
    },
    mutations: {
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster richColors closeButton position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>
  </ErrorBoundary>,
);
