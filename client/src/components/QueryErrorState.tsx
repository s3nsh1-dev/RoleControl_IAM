import { RefreshCw } from "lucide-react";
import { getErrorMessage } from "../api/client";
import { Button, EmptyState } from "./ui";

export function QueryErrorState({
  error,
  title = "Unable to load data",
  description,
  onRetry,
  isRetrying = false,
}: {
  error: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  return (
    <EmptyState>
      <div className="query-error-state">
        <strong>{title}</strong>
        <span>{description ?? getErrorMessage(error)}</span>
        {onRetry ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isRetrying}
            onClick={onRetry}
          >
            <RefreshCw size={16} />
            Retry
          </Button>
        ) : null}
      </div>
    </EmptyState>
  );
}
