import test from "node:test";
import assert from "node:assert/strict";
import { isPublicBrowsePath } from "../lib/public-routes.ts";
import {
  prepareComparison,
  getSubscriptionAccess,
} from "../lib/subscriptions.ts";
import { returnPath, signInPath } from "../lib/navigation.ts";

const access = {
  is_plus: false,
  enforcement_enabled: true,
  comparison_pair: null,
  resets_at: "2026-10-26T00:00:00+01:00",
};
const history = async () => [
  { trading_date: "2026-10-19", close_price: 100 },
  { trading_date: "2026-10-20", close_price: 105 },
];
function clientFor({
  owner = "account-a",
  result = access,
  error = null,
} = {}) {
  const calls = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: owner } }, error: null }),
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: result, error };
    },
  };
  return { client, calls };
}

test("only discovery URLs bypass sign-in; personal, comparison and disguised URLs stay protected", () => {
  for (const path of [
    "/",
    "/pesquisa?q=BAI",
    "/mercado",
    "/mercado/asset-id",
    "/noticias?pagina=2",
    "/noticias/market-update",
    "/planos",
  ])
    assert.equal(isPublicBrowsePath(path), true, path);
  for (const path of [
    "/dashboard",
    "/carteira",
    "/carteira/id",
    "/lista",
    "/alertas?instrumento=id",
    "/comparar",
    "/conta",
    "/actividade/id",
    "/resumos",
    "/simular",
    "/agenda",
    "/mercado/../carteira",
    "/noticias/../lista",
    "https://other.example/mercado",
    "//other.example/planos",
  ])
    assert.equal(isPublicBrowsePath(path), false, path);
  assert.equal(returnPath("/planos"), "/planos");
  assert.equal(
    signInPath("/alertas?instrumento=id"),
    "/?entrar=1&next=%2Falertas%3Finstrumento%3Did",
  );
});

test("history failure and insufficient selected-period history never spend a weekly comparison", async () => {
  const { client, calls } = clientFor();
  await assert.rejects(
    prepareComparison(
      client,
      "account-a",
      ["a", "b"],
      async () => {
        throw new Error("offline");
      },
      0,
    ),
    /offline/,
  );
  await assert.rejects(
    prepareComparison(
      client,
      "account-a",
      ["a", "b"],
      history,
      Date.parse("2026-10-20"),
    ),
    /COMPARISON_DATA_UNAVAILABLE/,
  );
  await assert.rejects(
    prepareComparison(client, "account-a", ["a", "a"], history, 0),
    /INVALID_COMPARISON/,
  );
  assert.deepEqual(calls, []);
});

test("an account switch during history loading cannot claim a comparison for the next account", async () => {
  const { client, calls } = clientFor({ owner: "account-b" });
  await assert.rejects(
    prepareComparison(client, "account-a", ["a", "b"], history, 0),
    /COMPARISON_SIGN_IN_REQUIRED/,
  );
  assert.deepEqual(calls, []);
});

test("backend Free limits deny the chart even when public history is available", async () => {
  const { client, calls } = clientFor({
    error: { message: "FREE_COMPARISON_WEEK_LIMIT" },
  });
  await assert.rejects(
    prepareComparison(client, "account-a", ["a", "b"], history, 0),
    (error) => error.message === "FREE_COMPARISON_WEEK_LIMIT",
  );
  assert.deepEqual(calls, [
    { name: "authorize_chart_comparison", args: { security_ids: ["a", "b"] } },
  ]);
});

test("Plus and rollout status come from the server; existing pairs can be retried", async () => {
  for (const snapshot of [
    { ...access, comparison_pair: ["a", "b"] },
    { ...access, is_plus: true },
    { ...access, enforcement_enabled: false },
  ]) {
    const { client, calls } = clientFor({ result: snapshot });
    const result = await prepareComparison(
      client,
      "account-a",
      ["b", "a"],
      history,
      0,
    );
    assert.deepEqual(result.access, snapshot);
    assert.equal(result.histories.length, 2);
    assert.equal(calls[0].name, "authorize_chart_comparison");
  }
});

test("unavailable or malformed entitlement responses fail closed", async () => {
  for (const result of [
    null,
    {},
    { ...access, is_plus: "true" },
    { ...access, resets_at: "invalid" },
  ]) {
    const { client } = clientFor({ result });
    await assert.rejects(
      getSubscriptionAccess(client),
      /SUBSCRIPTION_UNAVAILABLE/,
    );
    await assert.rejects(
      prepareComparison(client, "account-a", ["a", "b"], history, 0),
      /SUBSCRIPTION_UNAVAILABLE/,
    );
  }
});
