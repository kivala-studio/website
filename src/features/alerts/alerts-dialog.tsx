"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useSyncExternalStore } from "react";

import {
  ALERT_KINDS,
  type AlertKind,
  type AlertRule,
  MOVEMENT_SENSITIVITIES,
  type MovementSensitivity,
  acceptsThreshold,
  defaultThreshold,
  hasThreshold,
  isPriceKind,
  priceDistance,
  priceShortcut,
} from "@/domain/account/alerts";
import { formatAmountForInput, parseAmount } from "@/domain/format/amount-input";
import { useAccountStores } from "@/features/account/account-provider";
import { PrivacyModeButton, usePrivacyMode } from "@/features/privacy/privacy-mode";
import { cn } from "@/ui/cn";
import { AmountField } from "@/ui/components/amount-field";
import { Button, IconButton } from "@/ui/components/buttons";
import { OptionGroup } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { HiddenValue } from "@/ui/components/feedback";
import { SwitchRow } from "@/ui/components/menu";
import { Skeleton } from "@/ui/components/states";
import type { Format } from "@/domain/format";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

/** The instrument an alerts dialog is about. `price`: the current price, when one is usable. */
export type AlertTarget = { id: string; symbol: string; bond: boolean; currency: string; price?: Decimal };

const TITLE: Record<AlertKind, string> = {
  price_above: "formatting.notification.priceAbove",
  price_below: "formatting.notification.priceBelow",
  percent_change_above: "formatting.notification.changeAbove",
  percent_change_below: "site.alerts.changeBelow",
  high_52w: "formatting.notification.high52Week",
  low_52w: "formatting.notification.low52Week",
  volume_above_average: "formatting.notification.volumeAbove",
  days_without_trades: "formatting.notification.noTrades",
};

const SENTENCE: Record<AlertKind, string> = {
  price_above: "formatting.notification.notifyReaches",
  price_below: "formatting.notification.notifyFalls",
  percent_change_above: "formatting.notification.notifyChangeExceeds",
  percent_change_below: "site.alerts.notifyChangeBelow",
  high_52w: "formatting.notification.notifyHigh52Week",
  low_52w: "formatting.notification.notifyLow52Week",
  volume_above_average: "formatting.notification.notifyVolumeAbove",
  days_without_trades: "formatting.notification.notifyNoTrades",
};

const SENSITIVITY: Record<MovementSensitivity, string> = {
  low: "notifications.movementAlert.low",
  normal: "site.alerts.sensitivityNormal",
  high: "notifications.movementAlert.high",
};

const NOTE_KEY = "investao.alerts.deliveryNote";
const places = (value: Decimal) => Math.min(value.decimalPlaces(), 8);

/** A rule's value as people read it: `100 000 Kz`, `−5%`, `2×`, `7 dias`; nothing for 52-week rules. */
export function thresholdText(rule: Pick<AlertRule, "kind" | "threshold">, target: Pick<AlertTarget, "bond" | "currency">, format: Format, t: (key: string, values?: Record<string, string>) => string) {
  const value = rule.threshold;
  switch (rule.kind) {
    case "price_above":
    case "price_below":
      return target.bond ? format.percent(value, { digits: places(value), signed: false }) : format.currency(value, { code: target.currency, digits: places(value) });
    case "percent_change_above":
    case "percent_change_below":
      return format.percent(value, { digits: places(value), signed: rule.kind === "percent_change_below" });
    case "volume_above_average":
      return `${format.number(value, { digits: places(value) })}×`;
    case "days_without_trades":
      return t("alerts.threshold.days", { arg1: format.number(value, { digits: 0 }) });
    default:
      return null;
  }
}

function unit(kind: AlertKind, target: AlertTarget, t: (key: string) => string, format: Format) {
  if (isPriceKind(kind)) return target.bond ? "%" : format.currency(0, { code: target.currency }).replace(/[\d\s.,−+-]/g, "");
  if (kind === "volume_above_average") return "×";
  if (kind === "days_without_trades") return t("alerts.unit.days");
  return "%";
}

/**
 * One instrument's alerts (iOS `MarketAlertSheet`, alerts part): its rules with pause, edit and delete, a new
 * rule editor for the eight kinds, and automatic movement alerts with their sensitivity.
 */
export function AlertsDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: AlertTarget }) {
  const t = useTranslations();
  const stores = useAccountStores();
  const [editing, setEditing] = useState<AlertRule | "new" | null>(null);

  useEffect(() => {
    if (!open || !stores) return;
    const controller = new AbortController();
    void stores.alerts.load(controller.signal);
    void stores.watchlist.load();
    return () => controller.abort();
  }, [open, stores]);

  const close = () => {
    setEditing(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={editing ? t(editing === "new" ? "common.newAlert" : "alerts.form.editTitle") : `${t("common.alerts")} · ${target.symbol}`}>
      {stores && open ? (
        editing ? (
          <AlertEditor key={editing === "new" ? "new" : editing.id} rule={editing === "new" ? null : editing} target={target} onDone={() => setEditing(null)} />
        ) : (
          <AlertList target={target} onEdit={setEditing} />
        )
      ) : null}
    </Dialog>
  );
}

function useDeliveryNote() {
  const subscribe = (listener: () => void) => {
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  };
  const read = () => {
    try {
      return window.localStorage.getItem(NOTE_KEY) === "dismissed";
    } catch {
      return false;
    }
  };
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  const [hidden, setHidden] = useState(false);
  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(NOTE_KEY, "dismissed");
    } catch {
      // Hidden for this visit only.
    }
  };
  return { visible: !dismissed && !hidden, dismiss };
}

function AlertList({ target, onEdit }: { target: AlertTarget; onEdit: (rule: AlertRule | "new") => void }) {
  const t = useTranslations();
  const format = useFormat();
  const stores = useAccountStores()!;
  const alerts = useSyncExternalStore(stores.alerts.subscribe, stores.alerts.getSnapshot, stores.alerts.getSnapshot);
  const list = useSyncExternalStore(stores.watchlist.subscribe, stores.watchlist.getSnapshot, stores.watchlist.getSnapshot);
  const note = useDeliveryNote();
  const rules = alerts.rules.filter((rule) => rule.securityID === target.id);
  const watched = list.order.includes(target.id);
  const translate = (key: string, values?: Record<string, string>) => t(key as never, values as never);
  // Thresholds are personal: privacy mode hides them; the rule type and its controls stay.
  const hidden = usePrivacyMode();

  return (
    <div className="flex flex-col gap-6" data-testid="alerts-panel">
      {note.visible ? (
        <div className="flex items-start gap-3 rounded-medium bg-accent-soft p-3 text-primary-text" data-testid="alerts-delivery-note">
          <Icon name="info" className="mt-0.5 shrink-0 text-accent" />
          <p className="flex-1 text-secondary">{t("site.alerts.delivery")}</p>
          <IconButton icon="close" label={t("site.alerts.dismissDelivery")} onClick={note.dismiss} className="-my-2 -mr-2" />
        </div>
      ) : null}

      <section aria-labelledby="alert-rules" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id="alert-rules" className="text-headline text-primary-text">
            {t("alerts.list.title")}
          </h3>
          {rules.length > 0 ? <PrivacyModeButton className="-my-2" /> : null}
        </div>
        {alerts.status === "loading" || alerts.status === "idle" ? (
          <div aria-label={t("alerts.list.loading")} role="status" className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : alerts.status === "failed" ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-secondary text-secondary-text">{t("errors.notification.loadAlertsFailed")}</p>
            <Button kind="secondary" icon="refresh" className="w-auto" onClick={() => void stores.alerts.load(undefined, true)}>
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : rules.length === 0 ? (
          <p className="text-secondary text-secondary-text">{t("alerts.list.emptyTitle")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline" data-testid="alert-rules">
            {rules.map((rule) => {
              const title = translate(TITLE[rule.kind]);
              const value = thresholdText(rule, target, format, translate);
              const pending = alerts.pending.has(`alert.${rule.id}`);
              return (
                <li key={rule.id} className="flex items-center gap-2 py-1" data-testid="alert-rule">
                  <div className="min-w-0 flex-1">
                    <SwitchRow
                      label={value && !hidden ? `${title} ${value}` : title}
                      checked={rule.isEnabled}
                      disabled={pending}
                      onChange={(enabled) => stores.alerts.setEnabled(rule.id, enabled)}
                    >
                      {value && hidden ? <HiddenValue className="text-secondary" /> : null}
                      {rule.isEnabled ? null : <span className="text-caption text-secondary-text">{t("common.paused")}</span>}
                    </SwitchRow>
                  </div>
                  <IconButton icon="edit" label={t("alerts.accessibility.editAlert", { arg1: title, arg2: hidden ? t("common.hiddenValue") : (value ?? target.symbol) })} disabled={pending} onClick={() => onEdit(rule)} />
                  <IconButton icon="trash" label={`${t("common.delete")}: ${title}`} disabled={pending} onClick={() => stores.alerts.delete(rule.id)} className="text-negative" />
                </li>
              );
            })}
          </ul>
        )}
        <Button icon="add" kind="secondary" onClick={() => onEdit("new")} disabled={alerts.status !== "loaded"} data-testid="new-alert">
          {t("common.newAlert")}
        </Button>
      </section>

      {watched ? (
        <section aria-labelledby="alert-movements" className="flex flex-col gap-2">
          <h3 id="alert-movements" className="text-headline text-primary-text">
            {t("common.automaticMovements")}
          </h3>
          <SwitchRow
            label={target.symbol}
            checked={list.automatic.get(target.id) ?? false}
            disabled={list.status !== "loaded" || list.pending.has(`automatic.${target.id}`)}
            onChange={(enabled) => stores.watchlist.setAutomatic(target.id, enabled)}
            testID="automatic-movements"
          />
          <p className="pt-2 text-secondary text-secondary-text">{t("settings.sensitivity.title")}</p>
          <OptionGroup
            label={t("settings.sensitivity.title")}
            options={MOVEMENT_SENSITIVITIES.map((value) => ({ value, title: translate(SENSITIVITY[value]) }))}
            value={list.sensitivity}
            onChange={(value) => stores.watchlist.setSensitivity(value)}
          />
        </section>
      ) : null}
    </div>
  );
}

function AlertEditor({ rule, target, onDone }: { rule: AlertRule | null; target: AlertTarget; onDone: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const stores = useAccountStores()!;
  const translate = (key: string, values?: Record<string, string>) => t(key as never, values as never);
  const kindID = useId();
  const valueID = useId();
  const [kind, setKind] = useState<AlertKind>(rule?.kind ?? (target.price ? "price_above" : "percent_change_above"));
  const [text, setText] = useState(() => (rule ? formatAmountForInput(rule.threshold.abs()) : ""));

  const choose = (next: AlertKind) => {
    setKind(next);
    const preset = defaultThreshold(next);
    if (preset && hasThreshold(next)) setText(formatAmountForInput(preset));
    else if (!hasThreshold(next)) setText("");
  };

  const entered = parseAmount(text);
  const threshold = !hasThreshold(kind) ? defaultThreshold(kind)! : entered && kind === "percent_change_below" ? entered.neg() : entered;
  const valid = threshold !== null && acceptsThreshold(kind, threshold);
  const distance = isPriceKind(kind) && entered && target.price ? priceDistance(entered, target.price) : undefined;

  const save = () => {
    if (!valid || !threshold) return;
    if (rule) void stores.alerts.update({ ...rule, kind, threshold });
    else void stores.alerts.create(target.id, kind, threshold);
    onDone();
  };

  return (
    <form
      className="flex flex-col gap-5"
      data-testid="alert-editor"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label htmlFor={kindID} className="flex flex-col gap-2">
        <span className="text-secondary text-secondary-text">{t("alerts.form.alertType")}</span>
        <span className="relative flex">
          <select
            id={kindID}
            value={kind}
            onChange={(event) => choose(event.target.value as AlertKind)}
            className="min-h-11 w-full appearance-none rounded-medium bg-elevated-background py-2 pr-10 pl-3 text-body text-primary-text"
            data-testid="alert-kind"
          >
            {ALERT_KINDS.map((value) => (
              <option key={value} value={value}>
                {translate(TITLE[value])}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-secondary-text" />
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor={valueID} className="text-body text-primary-text">
          {translate(SENTENCE[kind])}
        </label>
        {hasThreshold(kind) ? (
          <div className="flex min-h-11 items-center gap-2 rounded-medium bg-elevated-background px-3 focus-within:outline-2 focus-within:outline-accent">
            {kind === "percent_change_below" ? <span aria-hidden className="text-body text-secondary-text">−</span> : null}
            <AmountField
              id={valueID}
              value={text}
              onValueChange={setText}
              inputMode="decimal"
              aria-invalid={text !== "" && !valid}
              data-autofocus
              data-testid="alert-value"
              className="min-h-11 flex-1 bg-transparent text-body text-primary-text outline-none"
            />
            <span className="text-body text-secondary-text">{unit(kind, target, translate, format)}</span>
          </div>
        ) : null}
        {distance ? (
          <p className="text-secondary text-secondary-text" aria-live="polite">
            {distance.direction === "equal"
              ? t("alerts.form.sameAsCurrentPrice")
              : t(distance.direction === "above" ? "alerts.form.aboveCurrentPrice" : "alerts.form.belowCurrentPrice", {
                  arg1: format.percent(distance.percent, { digits: 1, signed: false }),
                })}
          </p>
        ) : null}
        {isPriceKind(kind) && target.price ? (
          <div className="flex flex-wrap gap-2">
            {[-10, -5, 5, 10].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => {
                  const shortcut = priceShortcut(target.price!, step);
                  setKind(shortcut.kind);
                  setText(formatAmountForInput(shortcut.threshold));
                }}
                className={cn("motion-press min-h-11 min-w-16 rounded-full bg-action-surface px-3 text-secondary font-semibold text-primary-text")}
              >
                {format.percent(step, { digits: 0 })}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button kind="secondary" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={!valid} data-testid="save-alert">
          {t(rule ? "alerts.form.saveChanges" : "common.createAlert")}
        </Button>
      </div>
    </form>
  );
}
