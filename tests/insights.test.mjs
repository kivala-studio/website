import test from "node:test";
import assert from "node:assert/strict";
import { verifiedInsights, priceReceipt } from "../lib/verified-insights.ts";
import {
  rankInsights,
  emptyExposure,
  recordExposure,
  recordUsefulness,
  feedbackAdjustment,
  pruneExposure,
  exposureRetention,
} from "../lib/insight-personalisation.ts";
import {
  parseControls,
  controlEnabled,
  featureNames,
  cohortBucket,
} from "../lib/intelligence-controls.ts";
import { emptyInterests } from "../lib/personalisation.ts";
import {
  evidence,
  now,
  period,
  securities,
  asset,
  id,
} from "./fixtures/wrap.mjs";
const trade = {
  id: id(200),
  security_id: asset,
  transaction_kind: "buy",
  quantity: "10",
  unit_price: "90",
  traded_on: "2026-10-01",
  created_at: "2026-10-01T10:00:00Z",
};
function generate(overrides = {}) {
  return verifiedInsights({
    evidence: evidence(),
    period,
    securities,
    transactions: [trade],
    watchedIDs: [asset],
    now,
    metadataFetchedAt: now,
    ledgerFetchedAt: now,
    ...overrides,
  });
}
const family = (items, name) => items.find((i) => i.family === name);
const candidate = (name, extra = {}) => ({
  id: name,
  factKeys: [name],
  topics: [],
  assets: [asset],
  family: "watchlistMovement",
  category: "watchlist",
  observedAt: now - 1000,
  expiresAt: now + 100000,
  significance: 1,
  ...extra,
});
const profile = { ...emptyInterests, watched: [asset] };

test("complete verified sessions produce independent watchlist and portfolio facts", () => {
  const result = generate();
  assert.equal(family(result, "watchlistMovement").value, "+10,00%");
  assert.equal(
    family(result, "watchlistSessionRun").title,
    "BAI: 5 sessões a subir",
  );
  assert.match(
    family(result, "watchlistClosingExtreme").body,
    /não é um recorde histórico/,
  );
  assert.equal(family(result, "portfolioPricePerformance").value, "+10,00%");
  assert.match(family(result, "portfolioPricePerformance").body, /\+100,00 Kz/);
  assert.equal(family(result, "portfolioAllocation").value, "100,00% em BAI");
  assert.equal(family(result, "watchlistMovement").recordIDs.length, 6);
  assert.equal(
    family(result, "watchlistMovement").factKeys[0],
    priceReceipt(asset, "2026-10-16T14:00:00Z"),
  );
});

test("a missing, nonfinal, off-close, or conflicting intermediate session cannot create an insight", () => {
  for (const alter of [
    (d) => d.observations.splice(2, 1),
    (d) => {
      d.observations[2].is_final = false;
    },
    (d) => {
      d.observations[2].observed_at = "2026-10-13T13:00:00Z";
    },
    (d) => d.observations.push({ ...d.observations[2], record_id: id(999) }),
  ]) {
    const data = evidence();
    alter(data);
    assert.deepEqual(generate({ evidence: data }), []);
  }
  const data = evidence();
  data.observations[2].ingestion_run_id = "";
  assert.deepEqual(generate({ evidence: data }), []);
});

test("incomplete membership suppresses comparative and portfolio totals without hiding verified single-asset patterns", () => {
  const second = { ...securities[0], id: id(50), symbol: "BFA" };
  const result = generate({
    securities: [...securities, second],
    watchedIDs: [asset, second.id],
    transactions: [trade, { ...trade, id: id(201), security_id: second.id }],
  });
  assert.equal(family(result, "watchlistMovement"), undefined);
  assert.equal(family(result, "watchlistBreadth"), undefined);
  assert.equal(family(result, "portfolioAllocation"), undefined);
  assert.ok(family(result, "watchlistSessionRun"));
});

test("flows after the baseline exclude price performance; allocation remains complete", () => {
  for (const traded_on of ["2026-10-10", "2026-10-14"]) {
    const result = generate({
      transactions: [
        trade,
        {
          ...trade,
          id: id(201),
          traded_on,
          created_at: `${traded_on}T10:00:00Z`,
        },
      ],
    });
    assert.equal(family(result, "portfolioPricePerformance"), undefined);
    assert.ok(family(result, "portfolioAllocation"));
  }
  assert.equal(
    family(
      generate({ transactions: [{ ...trade, quantity: "0.5" }] }),
      "portfolioAllocation",
    ),
    undefined,
  );
  assert.equal(
    family(generate({ ledgerFetchedAt: now - 900000 }), "portfolioAllocation"),
    undefined,
  );
});

test("a flat session breaks the consecutive run and a tie is not a new closing record", () => {
  const data = evidence();
  data.observations[4].price = "110";
  data.observations[5].price = "110";
  const result = generate({ evidence: data });
  assert.equal(family(result, "watchlistSessionRun"), undefined);
  assert.equal(family(result, "watchlistClosingExtreme"), undefined);
});

test("ranking rejects conflicting revisions, shares aliases, and preserves financial priority", () => {
  const first = candidate("first", { factKeys: ["revision-a", "close"] }),
    other = candidate("other", { factKeys: ["revision-b", "close"] });
  assert.equal(
    rankInsights([first, other], "watchlist", profile, emptyExposure(), now, 2)
      .length,
    1,
  );
  const exposure = recordExposure(emptyExposure(), first, true, now);
  assert.deepEqual(
    rankInsights([other, first], "watchlist", profile, exposure, now, 2),
    [],
  );
  assert.deepEqual(
    rankInsights(
      [first, { ...first, significance: 2 }],
      "watchlist",
      profile,
      emptyExposure(),
      now,
      2,
    ),
    [],
  );
  assert.deepEqual(
    rankInsights(
      [candidate("weak")],
      "home",
      profile,
      emptyExposure(),
      now,
      2,
    ).map((c) => c.id),
    ["weak"],
  );
  const portfolio = candidate("portfolio", {
    family: "portfolioPricePerformance",
    category: "portfolio",
    mandatory: true,
    significance: 0,
  });
  assert.equal(
    rankInsights(
      [portfolio],
      "portfolio",
      { ...profile, held: [asset] },
      recordExposure(emptyExposure(), portfolio, true, now),
      now,
      2,
    )[0].id,
    "portfolio",
  );
});

test("usefulness is fact or surface-family scoped, decays without stacking, and cannot downrank material or mandatory facts", () => {
  const item = candidate("item"),
    unrelated = candidate("unrelated", { family: "watchlistInformation" });
  let exposure = recordUsefulness(
    emptyExposure(),
    item,
    "watchlist",
    "fact",
    now,
  );
  exposure = recordUsefulness(
    exposure,
    item,
    "watchlist",
    "familyOnSurface",
    now,
  );
  assert.equal(
    feedbackAdjustment(item, "watchlist", exposure.feedback, now),
    -16,
  );
  assert.equal(feedbackAdjustment(item, "home", exposure.feedback, now), -12);
  assert.equal(
    feedbackAdjustment(unrelated, "watchlist", exposure.feedback, now),
    0,
  );
  assert.equal(
    feedbackAdjustment(
      item,
      "watchlist",
      exposure.feedback,
      now + 28 * 86400000,
    ),
    -8,
  );
  assert.equal(
    feedbackAdjustment(
      { ...item, significance: 3 },
      "watchlist",
      exposure.feedback,
      now,
    ),
    0,
  );
  assert.equal(
    feedbackAdjustment(
      { ...item, mandatory: true },
      "portfolio",
      exposure.feedback,
      now,
    ),
    0,
  );
  assert.equal(
    recordUsefulness(exposure, item, "watchlist", null, now).feedback.length,
    0,
  );
  assert.equal(
    pruneExposure(exposure, now + exposureRetention).feedback.length,
    0,
  );
});

test("feature kill switches survive expiry and disable dependent insight families", () => {
  const config = {
    schema_version: 1,
    version: 1,
    minimum_app_build: 0,
    effective_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 1000).toISOString(),
    features: Object.fromEntries(
      featureNames.map((f) => [
        f,
        {
          enabled: true,
          kill_switch: false,
          rollout_percentage: 100,
          rollout_salt: "test",
          audiences: ["production"],
        },
      ]),
    ),
  };
  const parsed = parseControls(config);
  assert.equal(
    controlEnabled(parsed, "browser", "watchlist_patterns", now),
    true,
  );
  parsed.features.insight_engine.kill_switch = true;
  assert.equal(
    controlEnabled(parsed, "browser", "watchlist_patterns", now + 2000),
    false,
  );
  assert.throws(() => parseControls({ ...config, extra: true }));
  assert.equal(
    cohortBucket("same", "watchlist_patterns", "salt"),
    cohortBucket("same", "watchlist_patterns", "salt"),
  );
});

test("publication insights require one primary source and share factual aliases across syndication", async () => {
  const { publicationInsights } =
    await import("../lib/publication-insights.ts");
  const article = {
    id: id(600),
    slug: "fixture",
    title: "Empresa anuncia resultados",
    summary: "Publicação de exemplo.",
    published_at: new Date(now - 60000).toISOString(),
    news_article_securities: [
      { securities: { id: asset, symbol: "BAI", name: "BAI" } },
    ],
    news_article_sources: [
      {
        is_primary: true,
        source_url: "https://example.invalid/results#section",
        source_title: "Resultados",
        news_sources: { name: "Fonte de exemplo" },
      },
    ],
  };
  const result = await publicationInsights(
    [article],
    [asset],
    period,
    now,
    now,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].source, "https://example.invalid/results");
  assert.ok(result[0].factKeys.includes(`article:${article.id}`));
  assert.deepEqual(
    await publicationInsights(
      [
        {
          ...article,
          news_article_sources: [
            ...article.news_article_sources,
            ...article.news_article_sources,
          ],
        },
      ],
      [asset],
      period,
      now,
      now,
    ),
    [],
  );
  assert.deepEqual(
    await publicationInsights(
      [
        {
          ...article,
          news_article_sources: [
            {
              ...article.news_article_sources[0],
              source_url: "https://name:secret@example.invalid",
            },
          ],
        },
      ],
      [asset],
      period,
      now,
      now,
    ),
    [],
  );
  const copy = await publicationInsights(
    [{ ...article, id: id(601) }],
    [asset],
    period,
    now,
    now,
  );
  assert.equal(copy[0].factKeys[1], result[0].factKeys[1]);
  assert.equal(
    rankInsights(
      [result[0], copy[0]],
      "watchlist",
      profile,
      emptyExposure(),
      now,
      2,
    ).length,
    1,
  );
});
