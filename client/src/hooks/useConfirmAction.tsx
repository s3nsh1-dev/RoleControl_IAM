import { useState } from "react";
import { ConfirmDialog } from '@/components/ui'

type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function useConfirmAction() {
  const [action, setAction] = useState<ConfirmAction | null>(null);

  return {
    confirm: setAction,
    confirmDialog: (
      <ConfirmDialog
        open={action !== null}
        title={action?.title ?? ""}
        description={action?.description ?? ""}
        confirmLabel={action?.confirmLabel}
        onClose={() => setAction(null)}
        onConfirm={() => {
          action?.onConfirm();
          setAction(null);
        }}
      />
    ),
  };
}
