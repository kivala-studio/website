import Decimal from "decimal.js";

import type { UnusualRule } from "@/domain/activity/preferences";
import type { Format, Translate } from "@/domain/format";
import type { EpochMs } from "@/domain/market/zone";

import { type UnusualEvent, type UnusualFacts, factNumber, factSymbols, factText } from "./unusual-activity";

/*
 * Factual wording for unusual activity (iOS `UnusualActivityCopy`). Push keys are shared with the backend, which
 * sends Angolan-formatted amounts as arguments; the page formats them the same way.
 */

export interface UnusualSignal {
  /** The magnitude, shown bold. */
  readonly value: string;
  /** What it measures, shown after the value. */
  readonly label: string;
  readonly direction?: "up" | "down";
  /** Only intraday events carry a meaningful time; session rules are end-of-day. */
  readonly time?: EpochMs;
}

type Tools = { t: Translate; format: Format };

const ZERO = new Decimal(0);
const isWhole = (value: Decimal) => value.isInteger();

export const kwanza = (value: Decimal, { format }: Tools) =>
  `${format.number(value, { digits: value.abs().lt(1000) && !isWhole(value) ? 2 : 0 })} Kz`;
const quantity = (value: Decimal, { format }: Tools) => format.number(value, { digits: isWhole(value) ? 0 : 2 });
const whole = (value: Decimal, { format }: Tools) => format.number(value, { digits: 0 });
const decimal = (value: Decimal, digits: number, { format }: Tools) => format.number(value, { digits });
const ratio = (value: Decimal | undefined, tools: Tools) => `${decimal(value ?? ZERO, 1, tools)}×`;
const percent = (value: Decimal, tools: Tools, digits = 2) => `${decimal(value, digits, tools)}%`;
const signedPercent = (value: Decimal, { format }: Tools) => `${format.number(value, { digits: 2, signed: true })}%`;
const sessions = (facts: UnusualFacts, tools: Tools) => whole(factNumber(facts, "baselineSessions") ?? new Decimal(90), tools);

const args = (...values: string[]) => Object.fromEntries(values.map((value, index) => [`arg${index + 1}`, value]));

const TRADE_KEYS: Record<string, string> = {
  bond: "notification.unusual.trade.bond",
  fund_unit: "legacy.notificationUnusualTradeFundUnit",
  unit: "notification.unusual.trade.unit",
  share: "notification.unusual.trade.share",
};

const SESSION_KEYS = {
  volume_spike: "legacy.notificationUnusualSessionVolumeSpike",
  trade_count_spike: "legacy.notificationUnusualSessionTradeCountSpike",
  price_move_up: "legacy.notificationUnusualSessionPriceMoveUp",
  price_move_down: "legacy.notificationUnusualSessionPriceMoveDown",
  dormancy_break: "legacy.notificationUnusualSessionDormancyBreak",
  spread_wider: "legacy.notificationUnusualSessionSpreadWider",
} as const;

function sessionBody(facts: UnusualFacts, rule: UnusualRule, tools: Tools): string | null {
  const { t } = tools;
  const number = (key: string) => factNumber(facts, key) ?? ZERO;
  switch (rule) {
    case "volume_spike":
      return t(SESSION_KEYS.volume_spike, args(decimal(number("ratio"), 1, tools)));
    case "trade_count_spike":
      return t(SESSION_KEYS.trade_count_spike, args(whole(number("tradeCount"), tools), decimal(number("ratio"), 1, tools)));
    case "price_move": {
      const change = number("changePercent");
      return t(change.isNegative() ? SESSION_KEYS.price_move_down : SESSION_KEYS.price_move_up, args(decimal(change.abs(), 2, tools), decimal(number("zScore"), 1, tools)));
    }
    case "dormancy_break":
      return t(SESSION_KEYS.dormancy_break, args(whole(number("dormantSessions"), tools)));
    case "spread_change":
      return factText(facts, "direction") === "wider" ? t(SESSION_KEYS.spread_wider, args(decimal(number("ratio"), 1, tools))) : null;
    default:
      return null;
  }
}

function digest(symbols: readonly string[], { t }: Tools): string {
  const unique = [...new Set(symbols)].sort();
  if (unique.length <= 1) return t("notification.unusual.digest.one", args(unique[0] ?? ""));
  if (unique.length === 2) return t("notification.unusual.digest.two", args(unique[0], unique[1]));
  return t("notification.unusual.digest.more", args(unique[0], unique[1], String(unique.length - 2)));
}

/** Title and body for an account notification, matching the push copy. */
export function unusualNotification(facts: UnusualFacts, rule: UnusualRule | null, symbol: string | null, tools: Tools): { title: string; body: string } {
  const { t } = tools;
  const name = symbol ?? factText(facts, "symbol") ?? "";
  const price = kwanza(factNumber(facts, "price") ?? ZERO, tools);
  switch (rule) {
    case "large_trade":
      return {
        title: t("notification.unusual.trade.title", args(name)),
        body: t(TRADE_KEYS[factText(facts, "securityKind") ?? ""] ?? TRADE_KEYS.share, args(quantity(factNumber(facts, "quantity") ?? ZERO, tools), name, price)),
      };
    case "large_order": {
      const side = factText(facts, "side") === "buy" ? "buy" : "sell";
      return {
        title: t(`notification.unusual.order.${side}.title`, args(name)),
        body: t(`notification.unusual.order.${side}.body`, args(kwanza(factNumber(facts, "orderValue") ?? ZERO, tools), price)),
      };
    }
    case "volume_spike":
    case "trade_count_spike":
    case "price_move":
    case "dormancy_break":
    case "spread_change": {
      const body = sessionBody(facts, rule, tools);
      if (body !== null) return { title: t("notification.unusual.session.title", args(factText(facts, "name") ?? name)), body };
      break;
    }
  }
  return { title: t("notification.unusual.digest.title"), body: digest(factSymbols(facts), tools) };
}

/** The full sentence for one event (screen readers). */
export function unusualSentence(event: UnusualEvent, tools: Tools): string {
  const { t } = tools;
  const { facts, observedValue } = event;
  switch (event.rule) {
    case "large_trade":
    case "large_order":
      return unusualNotification(facts, event.rule, event.symbol, tools).body;
    case "volume_spike":
      return t("unusualActivity.volumeSpike", args(ratio(factNumber(facts, "ratio"), tools), sessions(facts, tools)));
    case "trade_count_spike":
      return t(
        "unusualActivity.tradeCountSpike",
        args(whole(factNumber(facts, "tradeCount") ?? observedValue, tools), ratio(factNumber(facts, "ratio"), tools), sessions(facts, tools)),
      );
    case "price_move":
      return t(
        "unusualActivity.priceMove",
        args(signedPercent(factNumber(facts, "changePercent") ?? observedValue, tools), decimal(factNumber(facts, "zScore") ?? ZERO, 1, tools)),
      );
    case "dormancy_break":
      return t("unusualActivity.dormancyBreak", args(whole(factNumber(facts, "dormantSessions") ?? observedValue, tools)));
    case "spread_change":
    case "spread_shift":
      return t(
        factText(facts, "direction") === "narrower" ? "unusualActivity.spreadNarrower" : "unusualActivity.spreadWider",
        args(percent(factNumber(facts, "spreadPercent") ?? observedValue, tools), ratio(factNumber(facts, "ratio"), tools)),
      );
    case "book_imbalance":
      return t(
        factText(facts, "side") === "sell" ? "unusualActivity.bookImbalance.sell" : "unusualActivity.bookImbalance.buy",
        args(percent(factNumber(facts, "sharePercent") ?? ZERO, tools, 0)),
      );
  }
}

/** One line of the list: the magnitude, and what it measures. */
export function unusualSignal(event: UnusualEvent, tools: Tools): UnusualSignal {
  const { t } = tools;
  const { facts, observedValue } = event;
  switch (event.rule) {
    case "volume_spike":
      return { value: ratio(factNumber(facts, "ratio"), tools), label: t("unusualActivity.signal.volume") };
    case "trade_count_spike":
      return {
        value: t("unusualActivity.signal.trades.value", args(whole(factNumber(facts, "tradeCount") ?? observedValue, tools))),
        label: t("unusualActivity.signal.trades.label", args(ratio(factNumber(facts, "ratio"), tools))),
      };
    case "price_move": {
      const change = factNumber(facts, "changePercent") ?? observedValue;
      return {
        value: signedPercent(change, tools),
        label: t("unusualActivity.signal.priceMove", args(ratio(factNumber(facts, "zScore"), tools))),
        direction: change.isNegative() ? "down" : "up",
      };
    }
    case "dormancy_break":
      return {
        value: t("unusualActivity.signal.dormancy.value"),
        label: t("unusualActivity.signal.dormancy.label", args(whole(factNumber(facts, "dormantSessions") ?? observedValue, tools))),
      };
    case "spread_change":
    case "spread_shift":
      return {
        value: percent(factNumber(facts, "spreadPercent") ?? observedValue, tools),
        label: t("unusualActivity.signal.spread", args(ratio(factNumber(facts, "ratio"), tools))),
      };
    case "large_trade": {
      const price = factNumber(facts, "price") ?? ZERO;
      const value = factNumber(facts, "tradeValue") ?? (factNumber(facts, "quantity") ?? ZERO).times(price);
      return { value: kwanza(value, tools), label: t("unusualActivity.signal.largeTrade", args(kwanza(price, tools))), time: event.occurredAt };
    }
    case "large_order": {
      const side = factText(facts, "side") === "buy" ? "buy" : "sell";
      return {
        value: kwanza(factNumber(facts, "orderValue") ?? ZERO, tools),
        label: t(`unusualActivity.signal.largeOrder.${side}`, args(kwanza(factNumber(facts, "price") ?? ZERO, tools))),
        time: event.occurredAt,
      };
    }
    case "book_imbalance": {
      const side = factText(facts, "side") === "sell" ? "sell" : "buy";
      return { value: percent(factNumber(facts, "sharePercent") ?? ZERO, tools, 0), label: t(`unusualActivity.signal.bookImbalance.${side}`), time: event.occurredAt };
    }
  }
}
