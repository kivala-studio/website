import { type Page, expect, test } from "@playwright/test";

// W3 exit criteria against the demo build: the /dev/market view runs the real market store over
// `/api/market/snapshot` (demo scenarios). Evidence screenshots go to docs/evidence/w3.

const EVIDENCE = "docs/evidence/w3";

// Portuguese first: evidence shows the product wording.
test.use({ locale: "pt-AO" });
const SNAPSHOT_ROUTE = "**/api/market/snapshot**";

const market = (page: Page) => page.getByTestId("market");
/** Some current quotes: the recorded snapshot has instruments without a session price, so `partial`. */
const CURRENT = /^(available|partial)$/;

/** Hides or shows the tab the way the browser reports it to the page. */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    if (value) {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    } else {
      delete (document as { hidden?: boolean }).hidden;
      delete (document as { visibilityState?: string }).visibilityState;
    }
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test("the browser never requests an Edge Function @engines", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/dev/market?scenario=open");
  await expect(market(page)).toHaveAttribute("data-availability", CURRENT);
  await setHidden(page, true);
  await setHidden(page, false);
  await expect(market(page)).toHaveAttribute("data-suspended", "false");
  await expect(market(page)).toHaveAttribute("data-availability", CURRENT);
  expect(urls.some((url) => url.includes("/api/market/snapshot"))).toBe(true);
  expect(urls.filter((url) => url.includes("/functions/v1/"))).toEqual([]);
});

test("a failed snapshot is not retried before the poll loop's backoff", async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  await page.route(SNAPSHOT_ROUTE, (route) => {
    requests += 1;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      headers: { "retry-after": "30" },
      body: JSON.stringify({ error: { code: "SNAPSHOT_UNAVAILABLE" }, retry_after_seconds: 30 }),
    });
  });
  await page.goto("/dev/market?scenario=open");
  await expect(market(page)).toHaveAttribute("data-load", "failed");
  expect(requests).toBe(1);
  await page.clock.runFor(29_000);
  expect(requests).toBe(1);
  await page.clock.runFor(120_000);
  await expect.poll(() => requests).toBeGreaterThan(1);
  // Backoff grows: at most one request per poll tick, never a burst.
  expect(requests).toBeLessThanOrEqual(3);
});

test.describe("hidden tab and offline evidence", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Evidence is recorded once");

  test("a hidden tab revokes current quotes and showing it refreshes", async ({ page }) => {
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/market/snapshot")) requests += 1;
    });
    await page.goto("/dev/market?scenario=open");
    await expect(market(page)).toHaveAttribute("data-availability", CURRENT);
    const unconfirmed = () => page.getByText("Preço por confirmar").count();
    const whileVisible = await unconfirmed();
    await page.screenshot({ path: `${EVIDENCE}/visible-open.png` });

    await setHidden(page, true);
    await expect(market(page)).toHaveAttribute("data-suspended", "true");
    await expect(market(page)).not.toHaveAttribute("data-availability", CURRENT);
    await expect.poll(unconfirmed).toBeGreaterThan(whileVisible);
    const whileHidden = requests;
    await page.screenshot({ path: `${EVIDENCE}/hidden-revoked.png` });

    await setHidden(page, false);
    await expect(market(page)).toHaveAttribute("data-availability", CURRENT);
    await expect.poll(unconfirmed).toBe(whileVisible);
    expect(requests).toBe(whileHidden + 1);
  });

  test("losing the connection revokes quotes and shows the banner; reconnecting refreshes once", async ({ page, context }) => {
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/market/snapshot")) requests += 1;
    });
    await page.goto("/dev/market?scenario=open");
    await expect(market(page)).toHaveAttribute("data-availability", CURRENT);

    await context.setOffline(true);
    await expect(market(page)).toHaveAttribute("data-offline", "true");
    await expect(market(page)).toHaveAttribute("data-availability", "offline");
    await expect(page.getByRole("status").filter({ hasText: "Sem ligação à Internet" })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/offline.png` });

    const beforeReconnect = requests;
    await context.setOffline(false);
    await expect(market(page)).toHaveAttribute("data-availability", CURRENT);
    expect(requests).toBe(beforeReconnect + 1);
  });

  test("the offline demo scenario keeps dated evidence after the connection is lost", async ({ page }) => {
    await page.goto("/dev/market?scenario=offline");
    await expect(market(page)).toHaveAttribute("data-availability", "offline");
    await page.screenshot({ path: `${EVIDENCE}/scenario-offline.png` });
  });
});
