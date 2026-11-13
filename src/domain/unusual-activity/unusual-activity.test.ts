import Decimal from "decimal.js";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import pt from "../../../messages/pt.json";
import { createFormat, type FormatLocale, type Translate } from "../format";
import { unusualNotification, unusualSignal } from "./copy";
import { type FactValue, type UnusualEvent, decodeFacts, decodeUnusualEvents, factNumber, factSymbols, unusualGroups } from "./unusual-activity";

// Ported from iOS `UnusualActivityTests`. The push payload check has no web counterpart (no push here).

const translator = (locale: FormatLocale): Translate => {
  const t = createTranslator({ locale, messages: locale === "pt" ? pt : en });
  return (key, values) => t(key as never, values as never);
};
const tools = (locale: FormatLocale) => ({ t: translator(locale), format: createFormat(locale, translator(locale)) });
const plain = (text: string) => text.replaceAll(" ", " ").replaceAll(" ", " ");

let sequence = 0;
function event(security: string, rule: UnusualEvent["rule"], facts: Record<string, FactValue>): UnusualEvent {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    securityID: security,
    symbol: security.toUpperCase(),
    name: security,
    tradingDate: "2026-11-04",
    rule,
    observedValue: new Decimal(1),
    baselineValue: new Decimal(1),
    occurredAt: Date.parse("2026-11-04T10:15:00Z"),
    isWithdrawn: false,
    facts: new Map(Object.entries(facts)),
  };
}

describe("unusual activity", () => {
  it("decodes rows with their facts and skips unknown rules", () => {
    const rows = [
      {
        id: "1b0e6a5e-7a52-4c69-9a39-0d1c34e9a001",
        security_id: "1b0e6a5e-7a52-4c69-9a39-0d1c34e9a002",
        symbol: "BFA",
        name: "Banco BFA",
        trading_date: "2026-11-04",
        rule: "large_trade",
        observed_value: 25000000,
        baseline_value: 2000000,
        occurred_at: "2026-11-04T10:15:00+00:00",
        status: "active",
        facts: { symbol: "BFA", securityKind: "share", quantity: 625, price: "40000", late: false },
      },
      {
        id: "1b0e6a5e-7a52-4c69-9a39-0d1c34e9a003",
        security_id: "1b0e6a5e-7a52-4c69-9a39-0d1c34e9a004",
        symbol: "BAI",
        name: null,
        trading_date: "2026-11-04",
        rule: "future_rule",
        observed_value: 1,
        baseline_value: 1,
        occurred_at: "2026-11-04T10:15:00+00:00",
        status: "withdrawn",
        facts: { symbols: ["BAI"] },
      },
    ];
    const events = decodeUnusualEvents(rows);
    expect(events.map((item) => item.rule)).toEqual(["large_trade"]);
    expect(factNumber(events[0].facts, "price")?.toString()).toBe("40000");
    expect(factSymbols(decodeFacts(rows[1].facts))).toEqual(["BAI"]);
  });

  it("writes trades and orders as facts in both languages", () => {
    const trade = new Map<string, FactValue>([
      ["securityKind", "share"],
      ["quantity", new Decimal(1200)],
      ["price", new Decimal(39000)],
    ]);
    const ptTrade = unusualNotification(trade, "large_trade", "BFA", tools("pt"));
    expect(ptTrade.title).toBe("Negócio em BFA");
    expect(plain(ptTrade.body)).toBe("Alguém acabou de comprar 1 200 ações de BFA a 39 000 Kz por ação.");

    const order = new Map<string, FactValue>([
      ["side", "sell"],
      ["orderValue", new Decimal(25_000_000)],
      ["price", new Decimal(40500)],
    ]);
    // en_AO groups with commas here (the format module's CLDR cases); iOS Foundation prints spaces.
    expect(plain(unusualNotification(order, "large_order", "BAI", tools("en")).body)).toBe("Someone placed a sell order of 25,000,000 Kz at 40,500 Kz.");
  });

  it("puts followed securities first, then the strongest, and drops narrower spreads", () => {
    const groups = unusualGroups(
      [
        event("a", "volume_spike", { ratio: new Decimal(4) }),
        event("b", "volume_spike", { ratio: new Decimal("26.6") }),
        event("b", "price_move", { zScore: new Decimal("3.2") }),
        event("c", "spread_change", { direction: "narrower", ratio: new Decimal(218) }),
        event("d", "volume_spike", { ratio: new Decimal(9) }),
      ],
      new Set(["d"]),
    );
    expect(groups.map((group) => group.securityID)).toEqual(["d", "b", "a"]);
    expect(groups[1].events.map((item) => item.rule)).toEqual(["price_move", "volume_spike"]);
  });

  it("lists shares before bonds outside the watchlist", () => {
    const groups = unusualGroups(
      [event("bond", "large_trade", { securityKind: "bond" }), event("share", "volume_spike", { securityKind: "share", ratio: new Decimal(2) })],
      new Set(),
    );
    expect(groups.map((group) => group.securityID)).toEqual(["share", "bond"]);
  });

  it("names the security and its fact in a session notification", () => {
    const facts = new Map<string, FactValue>([
      ["name", "UNITEL"],
      ["ratio", new Decimal("26.6")],
    ]);
    const message = unusualNotification(facts, "volume_spike", null, tools("pt"));
    expect([message.title, message.body]).toEqual(["Atividade invulgar em UNITEL", "Negociou 26,6× o volume habitual."]);
  });

  it("renders a signal line for every rule", () => {
    const pt = tools("pt");
    const lines = (
      [
        ["large_trade", { quantity: new Decimal(625), price: new Decimal(40000) }],
        ["large_order", { side: "buy", orderValue: new Decimal(25_000_000), price: new Decimal(40500) }],
        ["volume_spike", { ratio: new Decimal("26.6") }],
        ["trade_count_spike", { tradeCount: new Decimal(48), ratio: new Decimal("6.2") }],
        ["price_move", { changePercent: new Decimal("-7.41"), zScore: new Decimal("3.2") }],
        ["dormancy_break", { dormantSessions: new Decimal(34) }],
        ["spread_change", { spreadPercent: new Decimal("4.5"), ratio: new Decimal("3.1") }],
        ["spread_shift", { spreadPercent: new Decimal("2.25"), ratio: new Decimal(2) }],
        ["book_imbalance", { side: "sell", sharePercent: new Decimal(82) }],
      ] as const
    ).map(([rule, facts]) => {
      const signal = unusualSignal(event("x", rule, facts), pt);
      return plain(`${signal.value} ${signal.label}`);
    });
    expect(lines).toEqual([
      "25 000 000 Kz num só negócio a 40 000 Kz",
      "25 000 000 Kz ordem de compra a 40 500 Kz",
      "26,6× o volume habitual",
      "48 negócios 6,2× o habitual",
      "-7,41% 3,2× a variação típica",
      "1.º negócio em 34 sessões",
      "4,50% diferença compra/venda, 3,1× a habitual",
      "2,25% diferença compra/venda, 2,0× a habitual",
      "82% do livro do lado da venda",
    ]);
    expect(unusualSignal(event("x", "price_move", { changePercent: new Decimal("-7.41") }), pt).direction).toBe("down");
  });
});
