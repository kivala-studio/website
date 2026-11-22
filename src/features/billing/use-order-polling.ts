"use client";

import { useEffect, useRef } from "react";

import { type WebOrder, WEB_ORDER_POLL_MS, isPendingWebOrder, webOrderPollDelay } from "@/domain/billing/web-pass";
import { reauthenticate } from "@/features/auth/reauthenticate";

import { readWebOrder } from "./repository";

/**
 * Reads a pending order's live status until it leaves `pending` (standing rule 9): every `WEB_ORDER_POLL_MS`, once a
 * minute for a reference order after its first ten minutes, paused while the tab is hidden and read again on return.
 * Past `expiresAt` it reads once more and stops; an order still pending then is reported as expired. A failed read
 * just waits for the next tick. `onUpdate` gets only answers for `userID`.
 */
export function useOrderPolling(order: WebOrder | null, userID: string, onUpdate: (order: WebOrder) => void) {
  const latest = useRef(order);
  const report = useRef(onUpdate);
  useEffect(() => {
    latest.current = order;
    report.current = onUpdate;
  });

  const pendingID = order && isPendingWebOrder(order) ? order.id : null;

  useEffect(() => {
    if (!pendingID || !userID) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let lastRead = false;

    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void read(), delay);
    };

    const next = () => {
      const current = latest.current;
      if (stopped || !current || current.id !== pendingID || !isPendingWebOrder(current)) return;
      const delay = webOrderPollDelay(current, Date.now());
      if (delay !== null) return schedule(delay);
      if (!lastRead) {
        lastRead = true;
        return schedule(0);
      }
      // Its time is up and the server still says pending: nothing more to wait for here.
      report.current({ ...current, status: "expired" });
    };

    async function read() {
      if (stopped || document.hidden) return;
      controller = new AbortController();
      const result = await readWebOrder(userID, pendingID!, controller.signal).catch(() => null);
      if (stopped) return;
      if (result && "order" in result) {
        latest.current = result.order;
        report.current(result.order);
      } else if (result?.failure === "signedOut") {
        stopped = true;
        return reauthenticate();
      }
      next();
    }

    const onVisibility = () => {
      clearTimeout(timer);
      controller?.abort();
      if (!document.hidden) void read();
    };

    // The first read comes one short interval in, also for an order resumed from an earlier visit.
    const first = latest.current ? Date.parse(latest.current.expiresAt) - Date.now() : 0;
    schedule(Math.max(0, Math.min(WEB_ORDER_POLL_MS, first)));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pendingID, userID]);
}
