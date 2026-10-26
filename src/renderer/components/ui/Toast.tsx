import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ToastVariant = 'success' | 'info' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** 毫秒；带 action 时默认 7000，否则 5000 */
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

const variantIcon = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
};

const variantColor = {
  success: 'text-success',
  info: 'text-accent',
  error: 'text-danger',
};

/** 全局 Toast：右下角堆叠，支持撤销等 action */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { ...options, id }]);
      const duration = options.duration ?? (options.action ? 7000 : 5000);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[calc(100vw-32px)] max-w-[360px] flex-col gap-2"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((item) => {
            const Icon = variantIcon[item.variant ?? 'info'];
            return (
              <div
                key={item.id}
                className="glass-panel pointer-events-auto flex items-start gap-2.5 rounded-lg p-3 shadow-float animate-scaleIn"
              >
                <Icon
                  size={16}
                  className={cn('mt-0.5 shrink-0', variantColor[item.variant ?? 'info'])}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      {item.description}
                    </p>
                  )}
                  {item.action && (
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-accent hover:underline"
                      onClick={async () => {
                        try {
                          await item.action?.onClick();
                        } finally {
                          dismiss(item.id);
                        }
                      }}
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="关闭提示"
                  className="rounded p-0.5 text-ink-subtle transition-colors hover:text-ink"
                  onClick={() => dismiss(item.id)}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
