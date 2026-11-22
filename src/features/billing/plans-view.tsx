"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { decodeAccessJSON } from "@/domain/account/watchlist";
import { type WebCheckoutFailure, type WebOrder, type WebOrderResult, type WebPlan, isPendingWebOrder } from "@/domain/billing/web-pass";
import { HttpError, isCancellation } from "@/domain/errors";
import { useAccount } from "@/features/account/account-provider";
import { readAccountRoute } from "@/features/account/results";
import { reauthenticate } from "@/features/auth/reauthenticate";
import { StoreButton } from "@/features/site/visuals";
import { cn } from "@/ui/cn";
import { Button } from "@/ui/components/buttons";
import { Card, READING_COLUMN } from "@/ui/components/layout";
import { ErrorState, FadeIn } from "@/ui/components/states";

import { type CheckoutRequest, CheckoutForm } from "./checkout-form";
import { CheckoutSkeleton } from "./checkout-skeleton";
import { OrderOutcome, PendingExpress, PendingReference } from "./order-views";
import { PlanStatus, isLifetimePlus } from "./plan-status";
import { cancelWebOrder, readPlansPage, readWebOrder, startWebCheckout } from "./repository";
import { useOrderPolling } from "./use-order-polling";

type Load = { status: "loading" } | { status: "failed" } | { status: "ready"; plans: WebPlan[] };

/** What an order's state is called: what to do while pending, how it ended otherwise. */
function orderTitleKey(order: WebOrder) {
  if (order.status === "pending") return order.method === "reference" ? "site.plans.referencePending" : "site.plans.expressPending";
  return `site.plans.outcome.${order.status}` as const;
}

/** Where focus lands in a new view, in this order: its heading, the chosen plan, its first control. */
const FOCUS_TARGETS = ["h2[tabindex]", "[role=radio][aria-checked=true]", "button, a[href]"];

/**
 * `/planos`: the member's plan and the Plus web pass (contract §7.5). A pending order (one per account) takes the page
 * until it settles, also on a later visit; an order settled during this visit shows how it ended; otherwise Free sees
 * the purchase and Plus its status, with the purchase one tap away (passes stack). With no passes on sale, Free gets
 * the App Store and Plus just its status.
 */
export function PlansView() {
  const t = useTranslations();
  const account = useAccount();
  const userID = account?.userID ?? "";
  const access = account?.access ?? null;
  const applyAccess = account?.applyAccess;

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [order, setOrder] = useState<WebOrder | null>(null);
  const [failure, setFailure] = useState<WebCheckoutFailure | null>(null);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Every result is applied only while the page still belongs to the account that asked (standing rule 9).
  const current = useRef(userID);
  useEffect(() => {
    current.current = userID;
  }, [userID]);
  const still = useCallback((asked: string) => current.current === asked, []);

  const announce = useCallback((text: string) => {
    // Cleared first, so the same words are read again.
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(text));
  }, []);

  const readPlans = useCallback(
    (signal?: AbortSignal) => {
      const asked = userID;
      return readPlansPage(asked, signal).then(
        (page) => {
          if (!still(asked)) return;
          setLoad({ status: "ready", plans: page.plans });
          // The account's one pending order comes back on every visit (a reference can wait 48 hours).
          const pending = page.orders.find(isPendingWebOrder) ?? null;
          setOrder((shown) => shown ?? pending);
        },
        (error: unknown) => {
          if (isCancellation(error) || signal?.aborted || !still(asked)) return;
          if (error instanceof HttpError && error.status === 401) return reauthenticate();
          setLoad({ status: "failed" });
        },
      );
    },
    [userID, still],
  );

  useEffect(() => {
    if (!userID) return;
    const controller = new AbortController();
    void readPlans(controller.signal);
    return () => controller.abort();
  }, [userID, readPlans]);

  // Once paid, the access document changes: re-read it so the rest of the app unlocks.
  const refreshAccess = useCallback(async () => {
    const asked = userID;
    const body = await readAccountRoute("/api/account/access", asked).catch(() => null);
    if (body && still(asked)) applyAccess?.(decodeAccessJSON(body.access));
  }, [userID, still, applyAccess]);

  const shownOrder = useRef(order);
  useEffect(() => {
    shownOrder.current = order;
  }, [order]);

  /** Shows an order's latest state; a change of state is announced, and a payment re-reads access. */
  const show = useCallback(
    (next: WebOrder) => {
      const shown = shownOrder.current;
      shownOrder.current = next;
      setFailure(null);
      setOrder(next);
      if (shown?.id === next.id && shown.status === next.status) return;
      announce(t(orderTitleKey(next)));
      if (next.status === "paid") void refreshAccess();
    },
    [announce, refreshAccess, t],
  );

  useOrderPolling(order, userID, show);

  /** An answer about an order: show it, or say why not. */
  const apply = useCallback(
    async (result: WebOrderResult, asked: string) => {
      if (!still(asked)) return;
      if ("order" in result) return show(result.order);
      switch (result.failure) {
        case "signedOut":
          return reauthenticate();
        case "pending": {
          // One pending order per account: resume it instead of reporting an error.
          const resumed = result.orderID ? await readWebOrder(asked, result.orderID).catch(() => null) : null;
          if (!still(asked)) return;
          if (resumed && "order" in resumed) return show(resumed.order);
          return void readPlans();
        }
        case "closed":
        case "productUnavailable":
          setFailure(result.failure);
          return void readPlans();
        case "notNeeded":
          setFailure(result.failure);
          return void refreshAccess();
        default:
          setFailure(result.failure);
          announce(t(`site.plans.failure.${result.failure}`));
      }
    },
    [announce, readPlans, refreshAccess, show, still, t],
  );

  const checkout = async ({ plan, method, phone, nif }: CheckoutRequest) => {
    const asked = userID;
    setFailure(null);
    const result = await startWebCheckout(asked, { productID: plan.id, method, ...(phone ? { phone } : {}), nif }).catch((error: unknown) => {
      if (isCancellation(error)) return null;
      return { failure: "unavailable" as const };
    });
    if (result) await apply(result, asked);
  };

  const cancel = async () => {
    if (!order || cancelling) return;
    const asked = userID;
    setCancelling(true);
    const result = await cancelWebOrder(asked, order.id).catch(() => ({ failure: "unavailable" as const }));
    if (!still(asked)) return;
    setCancelling(false);
    if ("order" in result) show(result.order);
    else if (result.failure === "signedOut") reauthenticate();
    else {
      setFailure(result.failure);
      announce(t(`site.plans.failure.${result.failure}`));
    }
  };

  const startOver = () => {
    setOrder(null);
    setFailure(null);
    setAdding(true);
  };

  const plans = load.status === "ready" ? load.plans : [];
  const lifetime = isLifetimePlus(access);
  const onSale = load.status === "ready" && plans.length > 0 && !lifetime;
  const pending = order && isPendingWebOrder(order) ? order : null;
  const settled = order && !pending ? (order as WebOrder & { status: Exclude<WebOrder["status"], "pending"> }) : null;
  // Plus sees its status first; the purchase opens on "Adicionar tempo" (passes stack).
  const showsForm = onSale && !order && (!access?.isPlus || adding);
  const offersTime = onSale && !order && access?.isPlus === true && !adding;

  // The view in the page's main slot; a new one fades in.
  const view = pending
    ? pending.method === "reference"
      ? "reference"
      : "express"
    : settled
      ? "outcome"
      : load.status !== "ready"
        ? load.status
        : showsForm
          ? "form"
          : plans.length === 0 && !access?.isPlus
            ? "store"
            : "none";

  // A new view replaces the control the member just used: when focus fell to the page, it moves into the new view, so
  // keyboard and screen reader users carry on from there. The first load leaves focus alone.
  const slot = useRef<HTMLDivElement>(null);
  const shownView = useRef<string | null>(null);
  useEffect(() => {
    const previous = shownView.current;
    shownView.current = view;
    if (previous === null || previous === "loading" || document.activeElement !== document.body) return;
    FOCUS_TARGETS.map((selector) => slot.current?.querySelector<HTMLElement>(selector))
      .find(Boolean)
      ?.focus();
  }, [view]);

  return (
    <div className={cn(READING_COLUMN, "gap-6")} data-testid="plans" data-view={view}>
      <PlanStatus
        access={access}
        action={
          offersTime ? (
            <Button kind="secondary" icon="add" className="sm:w-auto sm:self-start" onClick={() => setAdding(true)} data-testid="add-time">
              {t("site.plans.addTime")}
            </Button>
          ) : null
        }
      />

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {failure && view !== "form" ? (
        <p role="alert" className="motion-presence text-secondary text-negative" data-testid="plans-error">
          {t(`site.plans.failure.${failure}`)}
        </p>
      ) : null}

      <div ref={slot} className="contents">
        <FadeIn key={view} className="flex flex-col gap-6">
          {view === "loading" ? (
            <div role="status" aria-busy="true">
              <span className="sr-only">{t("common.loading")}</span>
              <CheckoutSkeleton />
            </div>
          ) : view === "failed" ? (
            <Card>
              <ErrorState
                message={t("subscriptions.plan.loadError")}
                action={
                  <Button
                    kind="secondary"
                    className="w-auto!"
                    onClick={() => {
                      setLoad({ status: "loading" });
                      void readPlans();
                    }}
                  >
                    {t("common.tryAgain")}
                  </Button>
                }
              />
            </Card>
          ) : view === "express" && pending ? (
            <PendingExpress order={pending} cancelling={cancelling} onCancel={() => void cancel()} />
          ) : view === "reference" && pending ? (
            <PendingReference
              order={pending}
              cancelling={cancelling}
              onCancel={() => void cancel()}
              onCopied={(label) => announce(t("site.plans.copied", { item: label }))}
            />
          ) : view === "outcome" && settled ? (
            <OrderOutcome order={settled} onNext={startOver} />
          ) : view === "form" ? (
            <CheckoutForm plans={plans} storeSubscription={access?.storeSubscription === true} failure={failure} onSubmit={checkout} />
          ) : view === "store" ? (
            <Card className="flex flex-col gap-5" data-testid="plans-unavailable">
              <p className="text-body text-primary-text">{t("site.plans.storeOnly")}</p>
              <StoreButton className="sm:w-auto! sm:self-start" />
            </Card>
          ) : null}
        </FadeIn>
      </div>
    </div>
  );
}
