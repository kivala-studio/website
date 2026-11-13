import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

/*
 * W14 weekly reading in demo mode. The `demo-clock` cookie pins the server's demo market to a regular week at a
 * given instant and the page clock follows it: Friday after the close, Saturday and Sunday in Luanda. The `shares`
 * ledger holds shares only, so every position has a verified close.
 */
test.use({ locale: "pt-AO" });
// Axe on long signed-in pages is slow when all three engines share the machine.
test.describe.configure({ timeout: 60_000 });
const expect = baseExpect.configure({ timeout: 20_000 });

const EVIDENCE = "docs/evidence/w14";
const FRIDAY_AFTER_CLOSE = Date.UTC(2026, 10, 13, 15, 0);
const SATURDAY = Date.UTC(2026, 10, 14, 10, 0);
const SUNDAY = Date.UTC(2026, 10, 15, 10, 0);
const AMOUNT = /\d\s?(Kz|AOA)\b/;

async function open(page: Page, context: BrowserContext, at: number, path: string, extra: [string, string][] = []) {
  await context.addCookies(
    [["demo-account", "free"], ["demo-scenario", "open"], ["demo-portfolio-scenario", "shares"], ["demo-clock", String(at)], ...extra].map(([name, value]) => ({
      name,
      value,
      // The server's host: `localhost` here, the Mac's address from the Firefox container.
      url: test.info().project.use.baseURL,
    })),
  );
  await page.clock.setFixedTime(at);
  await page.goto(path);
}

/** Serious and critical axe issues inside the new surface (the rest of each page is scanned by its own phase). */
const serious = async (page: Page, include: string) =>
  (await new AxeBuilder({ page }).include(include).analyze()).violations
    .filter((item) => ["serious", "critical"].includes(item.impact ?? ""))
    .map((item) => item.id);

test("@engines the watchlist reading opens its sources and leaves when dismissed", async ({ page, context }) => {
  await open(page, context, SATURDAY, "/lista");
  const card = page.getByTestId("watchlist-reading");
  const rows = card.getByTestId("watchlist-insight");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(2);
  await expect(card.getByRole("heading", { name: "Leitura da semana" })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/watchlist-reading-${test.info().project.name}.png`, fullPage: true });

  const first = rows.first();
  const headline = (await first.locator("button").first().innerText()).split("\n")[1];
  await first.locator("button").first().click();
  const detail = page.getByTestId("insight-detail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Verificado em");
  await expect(detail.getByTestId("insight-sources").or(detail.getByRole("link", { name: /Fonte/ }))).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/watchlist-detail-${test.info().project.name}.png`, animations: "disabled" });
  expect(await serious(page, '[data-testid="insight-detail"]')).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  // Opening consumed it: the observation leaves the card.
  await expect(card.getByText(headline, { exact: true })).toHaveCount(0);

  if ((await rows.count()) > 0) {
    const next = (await rows.first().locator("button").first().innerText()).split("\n")[1];
    await rows.first().getByTestId("watchlist-insight-menu").click();
    await page.getByTestId("watchlist-insight-dismiss").click();
    await expect(page.getByText(next, { exact: true })).toHaveCount(0);
  }
  expect(await serious(page, '[data-testid="watchlist-reading"]')).toEqual([]);
});

test("@engines portfolio tiles sit above each tab and open the detail", async ({ page, context }) => {
  await open(page, context, SATURDAY, "/carteira");
  const reading = page.getByTestId("portfolio-reading");
  await expect(reading.getByTestId("portfolio-insight").first()).toBeVisible();
  expect(await reading.getByTestId("portfolio-insight").count()).toBeLessThanOrEqual(2);
  await expect(reading.locator('[data-tile="weekly"]')).toBeVisible();

  await page.getByRole("tab", { name: "Distribuição" }).click();
  await expect(reading.locator('[data-tile="largest"]')).toBeVisible();
  await page.getByRole("tab", { name: "Resumo" }).click();
  await expect(reading.locator('[data-tile="strongest"], [data-tile="weekly"]').first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/portfolio-tiles-${test.info().project.name}.png`, fullPage: true });

  await reading.getByTestId("portfolio-insight").first().click();
  const detail = page.getByTestId("portfolio-insight-detail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Valores aproximados");
  await page.screenshot({ path: `${EVIDENCE}/portfolio-detail-${test.info().project.name}.png`, animations: "disabled" });
  expect(await serious(page, '[data-testid="portfolio-insight-detail"]')).toEqual([]);
});

test("@engines privacy mode hides the tiles and every personal row", async ({ page, context }) => {
  await open(page, context, SATURDAY, "/carteira", [["investao-privacy", "on"]]);
  await expect(page.getByTestId("portfolio")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Distribuição" })).toBeVisible();
  await expect(page.getByTestId("portfolio-reading")).toHaveCount(0);

  await page.goto("/inicio");
  const discover = page.getByTestId("home-discover");
  await expect(page.getByTestId("home-discover").or(page.getByTestId("home-context")).first()).toBeVisible();
  await expect(discover.locator('[data-category="portfolio"]')).toHaveCount(0);
  await page.goto("/lista");
  await expect(page.getByTestId("watchlist-row").first()).toBeVisible();
  await expect(page.getByTestId("watchlist-reading")).toHaveCount(0);
});

test("@engines Activity lists the weekly reading beside the server rows", async ({ page, context }) => {
  // The reading is evaluated on the first signed-in page and archived for Activity.
  await open(page, context, SATURDAY, "/lista");
  await expect(page.getByTestId("watchlist-insight").first()).toBeVisible();
  await page.goto("/atividade");
  const local = page.getByTestId("activity-row").filter({ has: page.locator('a[href$="/lista"], a[href$="/carteira"]') });
  await expect(local.first()).toBeVisible();
  await expect(page.getByText("Watchlist", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/activity-merged-${test.info().project.name}.png` });
  expect(await serious(page, '[data-testid="activity-row"]')).toEqual([]);
});

test("@engines Home is empty on Friday after the close until the Wrap exists", async ({ page, context }) => {
  await open(page, context, FRIDAY_AFTER_CLOSE, "/inicio");
  await expect(page.getByTestId("home-refresh")).toBeVisible();
  await expect(
    page
      .getByTestId("movement-feed")
      .or(page.getByRole("heading", { level: 1, name: "Início" }))
      .first(),
  ).toBeVisible();
  await expect(page.getByTestId("home-context")).toHaveCount(0);
  await expect(page.getByTestId("home-discover")).toHaveCount(0);
});

test("@engines Home shows Saturday's Discover list without amounts", async ({ page, context }) => {
  await open(page, context, SATURDAY, "/inicio");
  const discover = page.getByTestId("home-discover");
  await expect(discover.getByTestId("home-discover-row").first()).toBeVisible();
  expect(await discover.getByTestId("home-discover-row").count()).toBeLessThanOrEqual(5);
  await expect(discover.getByRole("heading", { name: "Para explorar este sábado" })).toBeVisible();
  expect(await discover.innerText()).not.toMatch(AMOUNT);
  await page.screenshot({ path: `${EVIDENCE}/home-saturday-${test.info().project.name}.png`, fullPage: true });
  expect(await serious(page, '[data-testid="home-discover"]')).toEqual([]);
});

test("@engines Home offers the week ahead on Sunday", async ({ page, context }) => {
  await open(page, context, SUNDAY, "/inicio");
  const card = page.getByTestId("home-context");
  await expect(card).toHaveAttribute("data-kind", "weekAhead");
  await expect(card).toHaveAttribute("href", /\/semana$/);
  await expect(card).toContainText("PRÓXIMA SEMANA");
  expect(await card.innerText()).not.toMatch(AMOUNT);
  await page.screenshot({ path: `${EVIDENCE}/home-sunday-${test.info().project.name}.png`, fullPage: true });
  expect(await serious(page, '[data-testid="home-context"]')).toEqual([]);
});
