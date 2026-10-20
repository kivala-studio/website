import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fetchPublicData } from "../lib/public-fetch.ts";

async function fixture(t, responses) {
  let calls = 0;
  const server = createServer((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.headers.apikey, "sb_publishable_fixture");
    const result = responses[Math.min(calls++, responses.length - 1)];
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    url: new URL(`http://127.0.0.1:${server.address().port}/quotes`),
    calls: () => calls,
  };
}

test("a transient database timeout recovers with a fresh response", async (t) => {
  const prices = { prices: [{ last_price: 97050 }] };
  const backend = await fixture(t, [
    { status: 500, body: { code: "57014" } },
    { status: 200, body: prices },
  ]);
  assert.deepEqual(await fetchPublicData(backend.url, "sb_publishable_fixture"), prices);
  assert.equal(backend.calls(), 2);
});

test("persistent database timeouts stop after one retry", async (t) => {
  const backend = await fixture(t, [{ status: 500, body: { code: "57014" } }]);
  await assert.rejects(fetchPublicData(backend.url, "sb_publishable_fixture"), /Public data unavailable/);
  assert.equal(backend.calls(), 2);
});

test("permission and other server errors fail without retrying", async (t) => {
  for (const status of [403, 500]) {
    const backend = await fixture(t, [{ status, body: { code: "42501" } }]);
    await assert.rejects(fetchPublicData(backend.url, "sb_publishable_fixture"), /Public data unavailable/);
    assert.equal(backend.calls(), 1);
  }
});
