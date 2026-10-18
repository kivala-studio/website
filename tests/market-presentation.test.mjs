import assert from "node:assert/strict";
import { test } from "node:test";
import { reading, priceText, usableQuote } from "../lib/market-presentation.ts";
const now = Date.parse("2026-10-13T12:00:00Z");
const security = {
  id: "equity",
  symbol: "BAIAAAAA",
  name: "BAI",
  currency: "AOA",
  security_type: "equity",
  issuer_id: null,
  isin: null,
  is_active: true,
};
function market() {
  return {
    securities: [security],
    closes: [],
    closesUnavailable: false,
    fetchedAt: new Date(now).toISOString(),
    quotes: {
      overview: [
        {
          status: "open",
          data_status: "current",
          last_updated_at: new Date(now).toISOString(),
          source: "BODIVA",
        },
      ],
      prices: [
        {
          security_id: security.id,
          trading_date: "2026-10-13",
          last_price: 100,
          close_price: null,
          verified_change_percent: 0,
          data_quality: {
            status: "valid",
            reasons: [],
            sourceObservedAtEpoch: now / 1000 - 30,
            validUntilEpoch: now / 1000 + 60,
          },
        },
      ],
    },
  };
}
test("a confirmed unchanged quote differs from missing or expired movement", () => {
  const m = market();
  assert.equal(reading(security, m, now).change, 0);
  m.quotes.prices[0].verified_change_percent = null;
  assert.equal(reading(security, m, now).change, null);
  m.quotes.prices[0].verified_change_percent = 2;
  const expired = reading(security, m, now + 61000);
  assert.equal(expired.price, 100);
  assert.equal(expired.change, null);
  assert.equal(expired.stale, true);
});
test("a historical official reference cannot claim a current movement", () => {
  const m = market();
  m.quotes.prices = [];
  m.quotes.reference_prices = [
    {
      security_id: security.id,
      reference_price: {
        price: 99,
        price_date: "2026-10-12",
        traded_at: null,
        collected_at: "2026-10-12T16:00:00Z",
        source_url: "https://www.bodiva.ao/source",
        source_hash: "a".repeat(64),
        parser_version: "1",
      },
    },
  ];
  const r = reading(security, m, now);
  assert.equal(r.price, 99);
  assert.equal(r.change, null);
  assert.equal(r.stale, true);
  m.quotes.reference_prices[0].reference_price.source_url =
    "https://bodiva.ao.example.com/source";
  assert.equal(reading(security, m, now).price, null);
});
test("invalid provenance and future observations never become public prices", () => {
  const m = market();
  m.quotes.prices[0].data_quality.reasons = ["missingProvenance"];
  assert.equal(reading(security, m, now).price, null);
  m.quotes.prices[0].data_quality.reasons = [];
  m.quotes.prices[0].trading_date = "2026-10-14";
  assert.equal(reading(security, m, now).price, null);
});
test("equities and bonds retain their different quotation units", () => {
  assert.match(priceText(security, 100), /Kz$/);
  assert.match(
    priceText(
      { ...security, security_type: "treasury_bond", symbol: "OJ15N31C" },
      97.5,
    ),
    /%$/,
  );
  assert.equal(priceText(security, null), "Indisponível");
});

test("closed-session valuation uses the verified quote, never a display reference", () => {
  const m = market();
  m.quotes.overview[0].status = "closed";
  m.quotes.prices[0].trading_date = "2026-10-12";
  m.closes = [
    {
      security_id: security.id,
      price: 97,
      trading_date: "2026-10-12",
      confirmed_at: "2026-10-12T16:00:00Z",
      verified_change_percent: 1,
    },
  ];
  assert.equal(usableQuote(security, m, now).price, 100);
  assert.equal(usableQuote(security, m, now + 61000), null);
  m.quotes.prices = [];
  assert.equal(usableQuote(security, m, now), null);
});
