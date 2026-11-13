import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

/*
 * W13 in demo mode: `/api/market/unusual-activity` serves today's rows for every rule (`empty` has none); a
 * failed read is a 503 from the same route. BFA and BAI are in the default demo watchlist.
 */
test.use({ locale: "pt-AO" });
const expect = baseExpect.configure({ timeout: 15_000 });

const EVIDENCE = "docs/evidence/w13";
const ROUTE = "**/api/market/unusual-activity";

async function signIn(context: BrowserContext, scenario: "open" | "empty" = "open") {
  await context.addCookies(
    [
      ["demo-account", "free"],
      ["demo-scenario", scenario],
    ].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })),
  );
}

const groups = (page: Page) => page.getByTestId("unusual-group");

test("groups followed instruments first, shares before bonds, one line per signal", async ({ page, context }) => {
  await signIn(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atividade-invulgar");
  await expect(groups(page).first()).toBeVisible();

  await expect(page.getByRole("heading", { name: "Lista de acompanhamento", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mercado", exact: true })).toBeVisible();
  const symbols = await groups(page).evaluateAll((items) => items.map((item) => item.querySelector("span.truncate")?.textContent));
  expect(symbols.slice(0, 2)).toEqual(["BFAAAAAA", "BAIAAAAA"]);
  expect(symbols.at(-1)).toBe("OF15O26A");

  // Every rule renders; the narrower spread is left out.
  const rules = await page.getByTestId("unusual-signal").evaluateAll((items) => items.map((item) => item.getAttribute("data-rule")));
  expect(new Set(rules)).toEqual(new Set(["large_trade", "large_order", "volume_spike", "trade_count_spike", "price_move", "dormancy_break", "spread_change", "spread_shift", "book_imbalance"]));
  expect(rules.filter((rule) => rule === "spread_change")).toHaveLength(1);

  const withdrawn = page.locator('[data-testid="unusual-signal"][data-withdrawn="true"]');
  await expect(withdrawn).toHaveCount(1);
  await expect(withdrawn).toContainText("Já não está no livro de ordens");
  await expect(page.getByText("Informação de mercado. Não constitui recomendação de investimento.")).toBeVisible();

  // The bell holds the same switches as Settings → Notificações.
  await page.getByTestId("unusual-settings").click();
  await expect(page.getByTestId("unusual-notification-settings").getByRole("switch")).toHaveCount(8);
  await page.keyboard.press("Escape");

  await groups(page).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/mercado\/BFAAAAAA/);
});

test("content, empty and error states have no serious axe issues, phone and desktop", async ({ page, context }) => {
  for (const state of ["content", "empty", "error"] as const) {
    await context.clearCookies();
    await signIn(context, state === "empty" ? "empty" : "open");
    await page.unroute(ROUTE);
    if (state === "error") await page.route(ROUTE, (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/atividade-invulgar");
      if (state === "content") await expect(groups(page).first()).toBeVisible();
      if (state === "empty") await expect(page.getByText("Sem atividade fora do habitual")).toBeVisible();
      if (state === "error") await expect(page.locator("main").getByRole("alert")).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([]);
      await page.screenshot({ path: `${EVIDENCE}/unusual-activity-${state}-${width}.png`, fullPage: true, animations: "disabled" });
    }
  }
});

test("a failed refresh keeps the list showing", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/atividade-invulgar");
  await expect(groups(page).first()).toBeVisible();
  await page.route(ROUTE, (route) => route.fulfill({ status: 503, body: "{}" }));
  await page.getByTestId("unusual-refresh").click();
  await expect(page.getByTestId("unusual-refresh")).toBeEnabled();
  await expect(groups(page).first()).toBeVisible();
});
