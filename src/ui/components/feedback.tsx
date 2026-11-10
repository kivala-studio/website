"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { cn } from "../cn";
import { Icon } from "../icons/icon";
import { Spinner } from "./states";

export type ToastMessage = {
  title: string;
  message: string;
  /** Shown with `onRetry`; a toast with a retry never dismisses itself. */
  actionTitle?: string;
  onRetry?: () => Promise<void> | void;
  /** Called when this toast closes without being replaced (dismissed or timed out). */
  onDismiss?: () => void;
};

type Toast = ToastMessage & { id: number };

const ToastContext = createContext<{ show: (toast: ToastMessage) => void; dismiss: () => void } | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast needs a <ToastHost> ancestor");
  return context;
}

const AUTO_DISMISS_MS = 7000;

/** One toast at a time, from the top, announced politely. */
export function ToastHost({ children }: { children: ReactNode }) {
  const t = useTranslations("components.toast");
  const [toast, setToast] = useState<Toast | null>(null);
  const [retrying, setRetrying] = useState(false);
  const counter = useRef(0);

  const current = useRef<Toast | null>(null);
  useEffect(() => {
    current.current = toast;
  }, [toast]);

  const dismiss = useCallback(() => {
    current.current?.onDismiss?.();
    current.current = null;
    setToast(null);
  }, []);
  const show = useCallback((next: ToastMessage) => {
    counter.current += 1;
    setToast({ ...next, id: counter.current });
  }, []);

  useEffect(() => {
    if (!toast || toast.onRetry) return;
    const timer = setTimeout(() => {
      if (current.current?.id === toast.id) dismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-2">
        {toast ? (
          <div key={toast.id} className="motion-toast pointer-events-auto flex w-full max-w-140 items-start gap-3 rounded-large bg-elevated-background py-4 pl-4 pr-1 shadow-lg">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="line-clamp-2 text-secondary font-semibold text-primary-text">{toast.title}</p>
              <p className="line-clamp-3 text-secondary text-secondary-text">{toast.message}</p>
              {toast.onRetry && toast.actionTitle ? (
                <button
                  type="button"
                  aria-busy={retrying || undefined}
                  onClick={async () => {
                    if (retrying) return;
                    setRetrying(true);
                    try {
                      await toast.onRetry?.();
                    } finally {
                      setRetrying(false);
                    }
                  }}
                  className="mt-1 inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-action-surface px-4 text-secondary font-semibold text-primary-text"
                >
                  {retrying ? <Spinner /> : null}
                  {retrying ? t("retrying") : toast.actionTitle}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t("dismiss")}
              disabled={retrying}
              onClick={dismiss}
              className="flex size-11 shrink-0 items-center justify-center text-caption text-secondary-text"
            >
              <Icon name="close" />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

const subscribe = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** `Sem ligação à Internet` while the browser is offline. */
export function OfflineBanner({ forceVisible = false }: { forceVisible?: boolean }) {
  const t = useTranslations();
  const online = useOnline();
  if (online && !forceVisible) return null;
  return (
    <div role="status" className="flex items-start gap-3 bg-elevated-background px-4 py-3">
      <Icon name="offline" className="mt-0.5 text-warning" />
      <div className="flex flex-col gap-1">
        <p className="text-secondary font-semibold text-primary-text">{t("common.noInternet")}</p>
        <p className="text-caption text-secondary-text">{t("components.offlineBanner.outdated")}</p>
      </div>
    </div>
  );
}

const MASK = "••••••";

/** Hides a personal value but keeps its layout; announced as "Valor oculto". */
export function SensitiveValue({ hidden, children, className }: { hidden: boolean; children: ReactNode; className?: string }) {
  const t = useTranslations("common");
  if (!hidden) return <>{children}</>;
  return (
    <span className={cn("inline-grid", className)}>
      <span aria-hidden inert className="invisible col-start-1 row-start-1 select-none">
        {children}
      </span>
      <span className="col-start-1 row-start-1 self-center truncate text-secondary-text">
        <span aria-hidden>{MASK}</span>
        <span className="sr-only">{t("hiddenValue")}</span>
      </span>
    </span>
  );
}
