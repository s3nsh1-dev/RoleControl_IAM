import type { ReactNode } from "react";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { ApiClientError } from '@/api/client'
import { useAuthMe } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth'
import { QueryErrorState } from '@/components/QueryErrorState'
import { SkeletonRows } from '@/components/ui'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const authMe = useAuthMe();
  const isUnauthorized =
    authMe.error instanceof ApiClientError && authMe.error.statusCode === 401;

  useEffect(() => {
    if (authMe.data) {
      setAuthenticated();
    }
  }, [authMe.data, setAuthenticated]);

  useEffect(() => {
    if (isUnauthorized) {
      clearAuth();
    }
  }, [clearAuth, isUnauthorized]);

  if (authMe.isLoading) {
    return (
      <main className="route-loading">
        <SkeletonRows rows={3} />
      </main>
    );
  }

  if (isUnauthorized) {
    return <Navigate to="/login" replace />;
  }

  if (authMe.isError) {
    return (
      <main className="route-loading">
        <QueryErrorState
          title="API unavailable"
          error={authMe.error}
          onRetry={() => void authMe.refetch()}
          isRetrying={authMe.isFetching}
        />
      </main>
    );
  }

  if (!authMe.data) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
