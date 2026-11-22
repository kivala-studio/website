"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { type SettledWebOrder, type WebOrder, type WebOrderStatus, webOrderDate } from "@/domain/billing/web-pass";
import { cn } from "@/ui/cn";
import { Button, IconButton } from "@/ui/components/buttons";
import { FlipList } from "@/ui/components/flip-list";
import { Card } from "@/ui/components/layout";
import { Spinner } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon, type IconName } from "@/ui/icons/icon";

import { AMOUNT_HERO } from "./checkout-form";

/** Seconds left as `9:41`; never negative. */
function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The clock, once a second, while the component is shown. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function CancelButton({ cancelling, onCancel }: { cancelling: boolean; onCancel: () => void }) {
  const t = useTranslations();
  return (
    <Button kind="outline" loading={cancelling} onClick={onCancel} className="sm:w-auto sm:self-start" data-testid="order-cancel">
      {t("common.cancel")}
    </Button>
  );
}

/** Express: the push is on the member's phone; the amount they confirm, the time left and a way out. */
export function PendingExpress({ order, cancelling, onCancel }: { order: WebOrder; cancelling: boolean; onCancel: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const now = useNow();
  return (
    <Card className="flex flex-col gap-6" data-testid="order-pending" data-method="mcx_express">
      <div className="flex items-start gap-3">
        <Spinner className="mt-1 shrink-0 text-[1.25rem] text-accent" />
        <h2 tabIndex={-1} className="text-section text-primary-text outline-none">{t("site.plans.expressPending")}</h2>
      </div>
      <div className="flex flex-col gap-1">
        <p className={AMOUNT_HERO}>{format.currency(order.amountAOA, { digits: 2 })}</p>
        <p role="timer" className="text-secondary text-secondary-text">
          {t("site.plans.expiresIn", { time: countdown(Date.parse(order.expiresAt) - now) })}
        </p>
      </div>
      <CancelButton cancelling={cancelling} onCancel={onCancel} />
    </Card>
  );
}

/** One copyable fact of a reference payment: the label, the value and a copy button that turns into a check. */
function CopyFact({ label, value, copyText, onCopied }: { label: string; value: string; copyText: string; onCopied: (label: string) => void }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <dt className="text-caption text-secondary-text desk:text-secondary">{label}</dt>
        <dd className="font-display text-price text-primary-text [overflow-wrap:anywhere]">{value}</dd>
      </div>
      <IconButton
        icon={copied ? "check" : "copy"}
        label={t("site.plans.copy", { item: label })}
        variant="filled"
        onClick={() =>
          void navigator.clipboard.writeText(copyText).then(
            () => {
              setCopied(true);
              onCopied(label);
            },
            () => setCopied(false),
          )
        }
      />
    </div>
  );
}

/** Reference: entity, reference and amount to pay at an ATM or in online banking, each copied with one tap. */
export function PendingReference({
  order,
  cancelling,
  onCancel,
  onCopied,
}: {
  order: WebOrder;
  cancelling: boolean;
  onCancel: () => void;
  onCopied: (label: string) => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const reference = order.reference;
  // Typed digits only: no grouping, the language's decimal mark.
  const typedAmount = format.locale === "pt" ? order.amountAOA.toFixed(2).replace(".", ",") : order.amountAOA.toFixed(2);
  return (
    <Card className="flex flex-col gap-4" data-testid="order-pending" data-method="reference">
      <h2 tabIndex={-1} className="text-section text-primary-text outline-none">{t("site.plans.referencePending")}</h2>
      <dl className="flex flex-col divide-y divide-hairline border-y border-hairline">
        {reference ? (
          <>
            <CopyFact label={t("site.plans.entity")} value={reference.entity} copyText={reference.entity} onCopied={onCopied} />
            <CopyFact
              label={t("site.plans.reference")}
              value={reference.reference.match(/.{1,3}/g)?.join(" ") ?? reference.reference}
              copyText={reference.reference}
              onCopied={onCopied}
            />
          </>
        ) : null}
        <CopyFact label={t("cash.amount")} value={format.currency(order.amountAOA, { digits: 2 })} copyText={typedAmount} onCopied={onCopied} />
      </dl>
      <p className="text-secondary text-secondary-text">{t("site.plans.validUntil", { date: format.timestamp(Date.parse(order.expiresAt)) })}</p>
      <CancelButton cancelling={cancelling} onCancel={onCancel} />
    </Card>
  );
}

const OUTCOME: Record<Exclude<WebOrderStatus, "pending">, { icon: IconName; tone: string }> = {
  paid: { icon: "check-circle", tone: "bg-accent-soft text-accent" },
  failed: { icon: "warning", tone: "bg-warning/12 text-warning" },
  expired: { icon: "warning", tone: "bg-warning/12 text-warning" },
  cancelled: { icon: "close", tone: "bg-secondary-text/12 text-secondary-text" },
  refunded: { icon: "info", tone: "bg-secondary-text/12 text-secondary-text" },
};

/** How an order of this visit ended, and the one way on: add time after a payment, start again otherwise. The pass's end date is in the status header above. */
export function OrderOutcome({ order, onNext }: { order: WebOrder & { status: Exclude<WebOrderStatus, "pending"> }; onNext: () => void }) {
  const t = useTranslations();
  const { icon, tone } = OUTCOME[order.status];
  const paid = order.status === "paid";
  return (
    <Card className="flex flex-col gap-6" data-testid="order-outcome" data-status={order.status}>
      <div className="flex items-center gap-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-[1.5rem]", tone)}>
          <Icon name={icon} />
        </span>
        <h2 tabIndex={-1} className="min-w-0 text-section text-primary-text outline-none">
          {t(`site.plans.outcome.${order.status}`)}
        </h2>
      </div>
      <Button kind={paid ? "secondary" : "primary"} onClick={onNext} className="sm:w-auto sm:self-start" data-testid="order-next">
        {t(paid ? "site.plans.addTime" : "site.plans.startAgain")}
      </Button>
    </Card>
  );
}

/** The account's past orders (`webOrderHistory`): length, amount, the day and how it ended. Absent when there are none. */
export function OrderHistory({ orders }: { orders: readonly SettledWebOrder[] }) {
  const t = useTranslations();
  const format = useFormat();
  if (orders.length === 0) return null;
  return (
    <Card title={t("site.plans.history")} titleId="order-history-title" data-testid="order-history">
      <FlipList className="flex flex-col divide-y divide-hairline">
        {orders.map((order) => (
          <li
            key={order.id}
            data-flip-key={order.id}
            data-status={order.status}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0"
          >
            <span className="font-display text-body font-medium text-primary-text">{t("site.plans.months", { count: order.months })}</span>
            <span className="text-right font-display text-body font-medium text-primary-text">{format.currency(order.amountAOA, { digits: 2 })}</span>
            <span className="col-span-2 text-secondary text-secondary-text">
              {format.date(Date.parse(webOrderDate(order)))} · {t(`site.plans.outcome.${order.status}`)}
            </span>
          </li>
        ))}
      </FlipList>
    </Card>
  );
}
