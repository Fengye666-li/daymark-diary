import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog__icon">
          <AlertTriangle size={20} />
        </div>
        <div className="confirm-dialog__content">
          <h2 id="confirm-title">{title}</h2>
          <p id="confirm-description">{description}</p>
        </div>
        <button
          className="icon-button confirm-dialog__close"
          type="button"
          aria-label="关闭"
          onClick={onCancel}
        >
          <X size={18} />
        </button>
        <div className="confirm-dialog__actions">
          <button className="button button--ghost" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="button button--danger"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
