import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect, test } from "@playwright/test";

/*
 * W7 in demo mode: the `demo-account` cookie (`free`, `plus`, `pro`) signs in a demo account whose data lives in
 * cookies, and `demo-scenario` picks the market. Screenshots are attached as evidence rather than compared:
 * demo data is re-dated to the run's day.
 */
test.use({ locale: "pt-AO" });

const INSTRUMENT = "/mercado/BAIAAAAA";

async function signIn(context: BrowserContext, tier: "free" | "plus", scenario = "open") {
  await context.addCookies(
    [
      ["demo-account", tier],
      ["demo-scenario", scenario],
    ].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })),
  );
}

const upgradeReason = (page: Page) => page.getByTestId("upgrade-reason");

async function closeUpgrade(page: Page) {
  await page.getByRole("button", { name: "OK" }).click();
  await expect(upgradeReason(page)).toBeHidden();
}

for (const scenario of ["open", "closed", "partial", "empty"] as const) {
  test(`/inicio ${scenario}: sections, light and dark, phone and desktop`, async ({ page, context }, testInfo) => {
    await signIn(context, "plus", scenario);
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await page.goto("/inicio");
        await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
        await expect(page.getByTestId("home-overview")).toBeVisible();
        await expect(page.getByTestId("home-movement")).toBeVisible();
        await expect(page.getByTestId("home-simulator")).toBeVisible();
        if (scenario === "empty") await expect(page.getByText("Cotações atuais indisponíveis. Voltamos a tentar automaticamente.")).toBeVisible();
        if (scenario === "closed") await expect(page.getByTestId("home-recaps")).toBeVisible();
        await testInfo.attach(`inicio-${scenario}-${scheme}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      }
    }
  });
}

test("/inicio stale: no current price in the movement feed, dated closes or none elsewhere", async ({ page, context }) => {
  await signIn(context, "plus", "stale");
  await page.goto("/inicio");
  await expect(page.getByTestId("home-overview")).toBeVisible();
  await expect(page.getByTestId("home-movement").getByText("Cotações atuais indisponíveis. Voltamos a tentar automaticamente.")).toBeVisible();
  // Rail tiles fall back to a dated close or `Preço por confirmar`: never a current change.
  await expect(page.getByTestId("home-watchlist").getByRole("listitem").first()).toBeVisible();
  await expect(page.getByTestId("home-watchlist").getByText(/^[+−-]\d+,\d+\s?%$/)).toHaveCount(0);
});

test("/inicio has no serious axe issues and opens the market session sheet", async ({ page, context }) => {
  await signIn(context, "free");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/inicio");
  await expect(page.getByTestId("home-index")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([]);

  await page.getByTestId("home-market-details").click();
  const sheet = page.getByTestId("market-session");
  await expect(sheet).toBeVisible();
  // `Tudo` is Plus: Free keeps the range and sees why.
  await sheet.getByRole("radio", { name: /tudo|todo o histórico/i }).click();
  await expect(upgradeReason(page)).toHaveText("Veja todo o histórico de preços com o Plus.");
});

test("keyboard only: search palette → instrument → follow", async ({ page, context }) => {
  await signIn(context, "plus");
  await page.goto("/inicio");
  await expect(page.getByTestId("home-overview")).toBeVisible();
  await page.keyboard.press("/");
  const palette = page.getByRole("dialog", { name: "Pesquisa" });
  await expect(palette.getByRole("searchbox")).toBeFocused();
  await page.keyboard.type("SBAO");
  await expect(palette.getByTestId("search-result").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/mercado\/SBAOAAAA$/);
  const star = page.getByTestId("instrument-actions").getByTestId("watch-star");
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await star.focus();
  await page.keyboard.press("Space");
  await expect(star).toHaveAttribute("aria-pressed", "true");

  // Recents remember the instrument, per account, in this browser.
  await page.goto("/pesquisa");
  await expect(page.getByRole("heading", { name: "Recentes" })).toBeVisible();
  await expect(page.getByTestId("search-result").first()).toContainText("SBAOAAAA");
});

test("Free: every plan gate shows its reason; the server keeps the limits", async ({ page, context }) => {
  await signIn(context, "free");
  await page.goto(INSTRUMENT);
  const actions = page.getByTestId("instrument-actions");
  await expect(actions).toBeVisible();

  // The demo Free list already holds four (one past the limit): another star is refused by the plan.
  await page.goto("/mercado/SBAOAAAA");
  await page.getByTestId("instrument-actions").getByTestId("watch-star").click();
  await expect(upgradeReason(page)).toBeVisible();
  await closeUpgrade(page);

  await page.goto(INSTRUMENT);
  await page.getByRole("radio", { name: /tudo|todo o histórico/i }).click();
  await expect(upgradeReason(page)).toHaveText("Veja todo o histórico de preços com o Plus.");
  await closeUpgrade(page);

  await page.getByTestId("export-history").click();
  await expect(upgradeReason(page)).toHaveText("Exporte o histórico de preços em CSV com o Plus.");
  await closeUpgrade(page);

  await page.getByRole("button", { name: "Ver liquidez" }).click();
  await expect(upgradeReason(page)).toHaveText("Veja a liquidez de cada título com o Plus.");
  await closeUpgrade(page);

  await page.getByRole("tab", { name: "Ordens" }).click();
  await expect(page.getByTestId("order-book-levels").locator("li")).toHaveCount(5);
  await page.getByTestId("order-book-unlock").click();
  await expect(page.getByRole("dialog", { name: "invest.ao Plus" })).toBeVisible();
  await closeUpgrade(page);

  // Comparison: the first pair is authorised; a third instrument is the server's refusal.
  await page.getByRole("tab", { name: "Visão geral" }).click();
  await page.getByTestId("compare").click();
  const candidates = page.getByTestId("comparison-candidate");
  await candidates.nth(0).click();
  await expect(page.getByTestId("comparison-chart")).toBeVisible();
  await candidates.nth(1).click();
  await expect(upgradeReason(page)).toHaveText("O plano gratuito permite um par de 2 instrumentos por semana.");
});

test("Plus: full history, CSV and the whole order book", async ({ page, context }) => {
  await signIn(context, "plus");
  await page.goto(INSTRUMENT);
  await page.getByRole("radio", { name: /tudo|todo o histórico/i }).click();
  await expect(upgradeReason(page)).toBeHidden();
  const download = page.waitForEvent("download");
  await page.getByTestId("export-history").click();
  expect((await download).suggestedFilename()).toBe("invest-ao-baiaaaaa-historico.csv");
  await expect(page.getByTestId("liquidity").getByText("Sessões com negócios")).toBeVisible();

  await page.getByRole("tab", { name: "Ordens" }).click();
  await expect(page.getByTestId("order-book-levels").locator("li")).toHaveCount(8);
  await expect(page.getByTestId("order-book-unlock")).toHaveCount(0);
});

test("listing scenario: the Home highlight opens the admission page", async ({ page, context }) => {
  await signIn(context, "plus", "listing");
  await page.goto("/inicio");
  await page.getByTestId("home-listing").click();
  await expect(page.getByTestId("listing")).toBeVisible();
  await expect(page.getByText("Admissão prevista")).toBeVisible();
  await expect(page.getByText("A aguardar confirmação")).toBeVisible();
});
