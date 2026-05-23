import { toast } from "sonner";

// Sonner-based replacement for window.confirm. Renders an in-app toast with
// Confirm / Cancel actions so destructive flows stay inside our own UI
// instead of triggering the browser's native dialog.
export function confirmToast(
  message: string,
  opts: {
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  },
) {
  const id = toast(message, {
    description: opts.description,
    duration: 10_000,
    action: {
      label: opts.confirmLabel ?? "Delete",
      onClick: () => {
        toast.dismiss(id);
        void opts.onConfirm();
      },
    },
    cancel: {
      label: "Cancel",
      onClick: () => opts.onCancel?.(),
    },
  });
}
