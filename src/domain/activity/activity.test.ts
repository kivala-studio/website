import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import pt from "../../../messages/pt.json";
import { createFormat, type FormatLocale, type Translate } from "../format";
import {
  ACTIVITY_WINDOW_MS,
  type ActivityItem,
  activityDays,
  alertItems,
  decodeAccountNotification,
  decodeActivityItem,
  decodeAlertDelivery,
  decodeDailyCloseFacts,
  hasNewActivity,
  isVisible,
  mergeItems,
  nextCursor,
} from "./activity";
import { activityText, dailyCloseCopy } from "./copy";

const translator = (locale: FormatLocale): Translate => {
  const t = createTranslator({ locale, messages: locale === "pt" ? pt : en });
  return (key, values) => t(key as never, values as never);
};
const tools = (locale: FormatLocale) => ({ t: translator(locale), format: createFormat(locale, translator(locale)) });

const USER = "4b4a1c2e-6f1d-4a8e-9a54-0c7d7d0f1a11";
const ASSET = "d49c260e-999d-4470-a7e1-041ba6618749";
const ARTICLE = "9d3817bf-0c2c-44ad-ad34-ce09e0340a3c";
// 2026-09-25 13:00 in Luanda.
const NOW = Date.parse("2026-09-25T12:00:00Z");

let sequence = 0;
function accountRow(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    user_id: USER,
    category: "asset_movement",
    security_id: ASSET,
    occurred_at: "2026-09-25T11:00:00Z",
    created_at: "2026-09-25T11:00:05.123456+00:00",
    read_at: null,
    content_state: "active",
    composition: { title: "UNITEL está a mexer", body: "UNITEL: +5,00% face ao último fecho.", accessibilityText: null, privacyClass: "public_market" },
    ...overrides,
  };
}

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    id: "delivery-1",
    created_at: "2026-09-25T11:00:00Z",
    is_read: false,
    rule_id: "RULE-1",
    market_price_id: "PRICE-1",
    market_alert_event_id: null,
    notification_rules: { kind: "price_above", threshold: 999, securities: { id: ASSET, symbol: "CURRENT" } },
    alert_snapshot: { kind: "price_above", threshold: 100, securities: { id: ASSET, symbol: "FROZEN" } },
    ...overrides,
  };
}

const account = (overrides: Record<string, unknown> = {}) => decodeAccountNotification(accountRow(overrides), USER)!;

describe("DailyCloseCopy", () => {
  const facts = decodeDailyCloseFacts({
    eventFamily: "daily_close",
    tradingDate: "2026-11-06",
    advancers: 3,
    decliners: 2,
    unchanged: 2,
    topSymbol: "BAI",
    topChangePercent: 4.5,
    watchedAdvancers: 1,
    watchedDecliners: 0,
    watchedCount: 2,
  })!;

  it("renders server facts in both languages; the watchlist line is in the app only", () => {
    const { t, format } = tools("pt");
    expect(dailyCloseCopy(facts, false, t, format)).toEqual({ title: "Fecho da BODIVA", body: "3 em alta e 2 em baixa. Maior variação: BAI +4,50%." });
    const english = tools("en");
    expect(dailyCloseCopy(facts, true, english.t, english.format).body).toBe("3 up and 2 down. Biggest move: BAI +4.50%. On your watchlist: 1 up and 0 down.");
  });

  it("a flat day has no biggest move", () => {
    const { t, format } = tools("pt");
    const flat = decodeDailyCloseFacts({ advancers: 0, decliners: 0, topSymbol: null, topChangePercent: null })!;
    expect(dailyCloseCopy(flat, true, t, format).body).toBe("Nenhuma ação mudou de preço.");
  });
});

describe("alert deliveries", () => {
  it("the frozen alert survives rule edits; a malformed snapshot is not replaced by today's rule", () => {
    expect(decodeAlertDelivery(delivery())?.symbol).toBe("FROZEN");
    expect(decodeAlertDelivery(delivery({ alert_snapshot: { threshold: "broken" } }))).toBeNull();
    expect(decodeAlertDelivery(delivery({ alert_snapshot: null }))?.symbol).toBe("CURRENT");
  });

  it("every device's delivery of one event is one row; different events stay separate", () => {
    const rows = [
      delivery({ id: "device-1", market_alert_event_id: "EVENT-A" }),
      delivery({ id: "device-2", market_alert_event_id: "event-a", is_read: true }),
      delivery({ id: "device-1b", market_alert_event_id: "event-b" }),
    ].map((row) => decodeAlertDelivery(row)!);
    const items = alertItems(rows);
    expect(items).toHaveLength(2);
    const first = items.find((item) => item.id === "alert:alert_rule:event:event-a")!;
    expect(first.deliveryIDs).toEqual(["device-1", "device-2"]);
    expect(first.read).toBe(true);
    // Without an event, rule and quote identify the match (contract §4.4).
    expect(decodeAlertDelivery(delivery())?.identity).toBe("rule:rule-1:price:price-1");
  });

  it("a malformed timestamp is dropped; a fractional one is kept", () => {
    expect(decodeAlertDelivery(delivery({ created_at: "invalid" }))).toBeNull();
    expect(decodeAlertDelivery(delivery({ created_at: "2026-09-25T12:00:00.123456+00:00" }))?.occurredAt).toBe(Date.parse("2026-09-25T12:00:00.123Z"));
  });

  it("a fired rule opens its instrument, and its threshold never enters the row", () => {
    const [item] = alertItems([decodeAlertDelivery(delivery({ alert_snapshot: { kind: "price_below", threshold: 999999, securities: { id: ASSET, symbol: "BAI" } } }))!]);
    expect(item.destination).toEqual({ kind: "instrument", securityID: ASSET });
    expect(JSON.stringify(item)).not.toContain("999999");
    const text = activityText(item, { ...tools("pt"), symbolOf: () => undefined, privacyMode: false });
    expect(text).toMatchObject({ title: "BAI · O seu alerta de preço foi atingido", body: "Abra o título para consultar o alerta." });
    expect(JSON.stringify(text)).not.toContain("999");
  });

  it("negative change thresholds are valid rules", () => {
    expect(decodeAlertDelivery(delivery({ alert_snapshot: { kind: "percent_change_below", threshold: -5, securities: { id: ASSET, symbol: "BAI" } } }))).not.toBeNull();
  });
});

describe("account notifications", () => {
  it("routes every category to its destination or deliberately to none", () => {
    const destination = (overrides: Record<string, unknown>) => decodeAccountNotification(accountRow(overrides), USER)?.destination;
    expect(destination({ category: "asset_movement" })).toEqual({ kind: "instrument", securityID: ASSET });
    expect(destination({ category: "market_listing" })).toEqual({ kind: "instrument", securityID: ASSET });
    expect(destination({ category: "unusual_activity" })).toEqual({ kind: "instrument", securityID: ASSET });
    expect(destination({ category: "unusual_activity", security_id: null, unusual_digest_on: "2026-09-25" })).toEqual({ kind: "unusualDigest" });
    expect(destination({ category: "market_recap", security_id: null, article_id: ARTICLE })).toEqual({ kind: "article", articleID: ARTICLE, slug: null });
    expect(destination({ category: "news_publication", security_id: null, article_id: ARTICLE })).toMatchObject({ kind: "article" });
    expect(destination({ category: "weekly_wrap", security_id: null, wrap_starts_on: "2026-09-21" })).toEqual({ kind: "wrap", period: "weekly-2026-09-21" });
    expect(destination({ category: "portfolio_daily", security_id: null })).toEqual({ kind: "portfolio" });
    expect(destination({ category: "daily_close", security_id: null, close_on: "2026-09-24" })).toEqual({ kind: "none" });
    // A routing id is required where the category has one.
    expect(destination({ category: "news_publication", security_id: null })).toBeUndefined();
    expect(destination({ category: "something_new" })).toBeUndefined();
  });

  it("drops another account's row and keeps an unavailable one with neutral copy", () => {
    expect(decodeAccountNotification(accountRow({ user_id: ASSET }), USER)).toBeNull();
    const withdrawn = account({ content_state: "withdrawn", category: "portfolio_daily", security_id: null });
    expect(withdrawn).toMatchObject({ destination: { kind: "none" }, copy: { kind: "unavailable" } });
    expect(isVisible(withdrawn, NOW)).toBe(true);
    expect(activityText(withdrawn, { ...tools("pt"), symbolOf: () => undefined, privacyMode: true }).title).toBe("Informação indisponível");
  });

  it("the next page's keyset is the last row's created_at and id together", () => {
    const rows = [accountRow(), accountRow({ created_at: "2026-09-24T10:00:00.5+00:00" })];
    expect(nextCursor(rows)).toEqual({ createdAt: "2026-09-24T10:00:00.5+00:00", id: rows[1].id });
    expect(nextCursor([])).toBeNull();
  });

  it("privacy mode hides personal rows and keeps public market facts", () => {
    const options = { ...tools("pt"), symbolOf: () => undefined, privacyMode: true };
    const personal = account({ category: "portfolio_daily", security_id: null, composition: { title: "A tua carteira ganhou 120 000 Kz", body: "+3,2%", privacyClass: "private_financial" } });
    const text = activityText(personal, options);
    expect(text).toEqual({
      title: "Nova informação em invest.ao",
      body: "Conteúdo pessoal oculto no Modo de privacidade.",
      accessibilityText: "Nova informação em invest.ao. Conteúdo pessoal oculto no Modo de privacidade.",
    });
    expect(activityText(account(), options).title).toBe("UNITEL está a mexer");
    const [alert] = alertItems([decodeAlertDelivery(delivery())!]);
    expect(activityText(alert, options).title).toBe("Nova informação em invest.ao");
  });
});

describe("activity policy", () => {
  it("news rows show today and yesterday only; movement history keeps its 28 days", () => {
    // Start of yesterday in Luanda: 2026-09-23T23:00Z.
    const cutoff = Date.parse("2026-09-23T23:00:00Z");
    const news = (at: number) => ({ ...account({ category: "news_publication", security_id: null, article_id: ARTICLE }), occurredAt: at });
    expect(isVisible(news(cutoff), NOW)).toBe(true);
    expect(isVisible(news(cutoff - 1), NOW)).toBe(false);
    const movement = { ...account(), occurredAt: cutoff - 1 };
    expect(isVisible(movement, NOW)).toBe(true);
    expect(isVisible({ ...movement, occurredAt: NOW - ACTIVITY_WINDOW_MS }, NOW)).toBe(false);
    expect(isVisible({ ...movement, occurredAt: NOW + 1 }, NOW)).toBe(false);
  });

  it("the bell counts unread rows of today and the six days before, Luanda midnight included", () => {
    // 2026-09-29 00:05 in Luanda.
    const clock = Date.parse("2026-09-28T23:05:00Z");
    const item = (at: number, read = false): ActivityItem => ({ ...account(), occurredAt: at, read });
    // Start of 2026-09-23 in Luanda.
    const sixDaysBefore = Date.parse("2026-09-22T23:00:00Z");
    expect(hasNewActivity([item(sixDaysBefore)], clock)).toBe(true);
    expect(hasNewActivity([item(sixDaysBefore - 1)], clock)).toBe(false);
    expect(hasNewActivity([item(clock - 60_000, true)], clock)).toBe(false);
    expect(hasNewActivity([], clock)).toBe(false);
  });

  it("groups by Luanda day, then by category in fixed order, newest first", () => {
    const clock = Date.parse("2026-09-28T23:05:00Z");
    const today = { ...account(), id: "account:a", occurredAt: Date.parse("2026-09-28T23:01:00Z") };
    const yesterday = { ...account(), id: "account:b", occurredAt: Date.parse("2026-09-28T22:55:00Z") };
    const portfolio = { ...account({ category: "portfolio_daily", security_id: null }), id: "account:c", occurredAt: Date.parse("2026-09-28T23:00:00Z") };
    const news = { ...account({ category: "news_publication", security_id: null, article_id: ARTICLE }), occurredAt: clock - 1000 };
    const days = activityDays([yesterday, portfolio, today, news], "movements", clock);
    expect(days.map((day) => day.date)).toEqual(["2026-09-29", "2026-09-28"]);
    expect(days[0].groups.map((group) => [group.category, group.items.map((row) => row.id)])).toEqual([
      ["movements", ["account:a"]],
      ["portfolio", ["account:c"]],
    ]);
    expect(activityDays([yesterday, news], "news", clock).flatMap((day) => day.groups.map((group) => group.category))).toEqual(["news"]);
  });

  it("a fresher page wins; older pages stay; a read row never becomes unread", () => {
    const older = { ...account(), id: "account:old", occurredAt: NOW - 10 * 86_400_000 };
    const row = { ...account(), id: "account:x", read: true };
    const merged = mergeItems([older, row], [{ ...row, read: false, copy: { kind: "unavailable" } }]);
    expect(merged.map((item) => item.id)).toEqual(["account:x", "account:old"]);
    expect(merged[0]).toMatchObject({ read: true, copy: { kind: "unavailable" } });
  });

  it("the browser keeps a route's well-formed items and drops the rest", () => {
    const item = account();
    expect(decodeActivityItem(JSON.parse(JSON.stringify(item)))).toEqual(item);
    expect(decodeActivityItem({ ...item, category: "other" })).toBeNull();
    expect(decodeActivityItem({ ...item, destination: { kind: "elsewhere" } })).toBeNull();
  });
});
