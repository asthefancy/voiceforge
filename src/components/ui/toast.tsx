import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "info" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToast | null>(null);

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

const TONE = {
  info: "border-border",
  success: "border-accent/50",
  error: "border-destructive/60",
} as const;

/**
 * 端末内で完結する軽量トースト。ブラウザの alert() を置き換え、
 * モバイルで邪魔にならない非ブロッキング通知を提供する。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, variant = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => remove(id), 3500);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-2xl",
                "data-[v=open]:animate-in slide-in-from-bottom-2",
                TONE[t.variant],
              )}
              data-v="open"
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  t.variant === "error" ? "text-destructive" : t.variant === "success" ? "text-accent" : "text-muted-foreground",
                )}
              />
              <p className="flex-1 text-sm">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                aria-label="閉じる"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** トースト表示関数を取得。ToastProvider の内側で使うこと。 */
export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast は ToastProvider の内側で使用してください");
  return ctx;
}
