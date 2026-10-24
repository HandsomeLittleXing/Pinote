import React from 'react';
import { Button } from './ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 确认对话框（纯 Tailwind，不依赖 MUI Dialog） */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="animate-fadeIn absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* 对话框 */}
      <div className="animate-scaleIn relative w-80 rounded-xl border border-line/10 bg-surface p-6 shadow-float">
        <h3 className="mb-2 text-base font-semibold text-ink">{title}</h3>
        <p className="mb-5 text-sm leading-relaxed text-ink-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
