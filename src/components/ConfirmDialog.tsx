import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-[#1B2229] border border-white/10 rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 ${danger ? 'text-[#E05252]' : 'text-[#F5B942]'}`} />
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-[#F4F5F6]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#9AA5B1] hover:text-[#F4F5F6] p-1 rounded"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#9AA5B1] leading-relaxed">{description}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#9AA5B1] hover:text-[#F4F5F6] bg-[#242C34] rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              danger
                ? 'bg-[#E05252] text-white hover:bg-[#c94545]'
                : 'bg-[#F5B942] text-[#101418] hover:bg-[#f6c45f]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
