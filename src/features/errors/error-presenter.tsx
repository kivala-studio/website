"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { telemetry } from "@/data/telemetry/client";
import { ErrorCoordinator } from "@/domain/errors";
import { useToast } from "@/ui/components/feedback";

/**
 * The tab's failure state: every store presents through it, so one toast shows at a time. Each
 * mapped failure is reported (sanitised, rate-limited).
 */
export const appErrors = new ErrorCoordinator((error) => telemetry?.reportError(error));

/**
 * Global presenter: the first entry of the visible cause group as one toast. Repeated failures of
 * an operation replace its entry; the retry button retries the whole group once, serially.
 * Needs a `<ToastHost>` ancestor.
 */
export function ErrorPresenter({ errors = appErrors }: { errors?: ErrorCoordinator }) {
  const t = useTranslations();
  const toast = useToast();
  const state = useSyncExternalStore(errors.subscribe, errors.getSnapshot, errors.getSnapshot);
  const current = state.entries[0];
  const shown = useRef(false);

  useEffect(() => {
    if (!current) {
      if (shown.current) toast.dismiss();
      shown.current = false;
      return;
    }
    shown.current = true;
    const { titleKey, messageKey, actionKey } = current.presentation;
    const retry = current.retry && actionKey ? () => errors.retryCurrent() : undefined;
    toast.show({
      title: t(titleKey),
      message: t(messageKey),
      actionTitle: retry && actionKey ? t(actionKey) : undefined,
      onRetry: retry,
      onDismiss: () => errors.dismissCurrent(),
    });
  }, [current, errors, t, toast]);

  return null;
}
