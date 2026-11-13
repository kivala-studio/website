import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

/*
 * W13 market information in demo mode. No live source sends market updates yet, so the entry points stay hidden
 * with the usual scenarios and appear with `demo-scenario=updates`.
 */
// Chips and presets animate their colours; axe must see the settled state.
test.use({ locale: "pt-AO", reducedMotion: "reduce" });
const expect = baseExpect.configure({ timeout: 15_000 });

const EVIDENCE = "docs/evidence/w13";

async function setScenario(context: BrowserContext, scenario: string, signedIn = false) {
  const cookies = [["demo-scenario", scenario], ...(signedIn ? [["demo-account", "plus"]] : [])];
  await context.addCookies(cookies.map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

test("updates filter by category and open their detail with related instruments", async ({ page, context }) => {
  await setScenario(context, "updates");
  await page.goto("/mercado");
  await expect(page.getByTestId("market-information-summary")).toContainText("Sessão com 186 negócios");
  await page.getByTestId("market-information-summary").click();

  const rows = page.getByTestId("market-update-row");
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText("Sessão com 186 negócios");
  await page.getByTestId("market-information-chip").filter({ hasText: "Emitentes" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("BAI publica o relatório e contas");
  await page.getByTestId("market-information-chip").filter({ hasText: "Tudo" }).click();
  await expectAccessible(page);
  await page.screenshot({ path: `${EVIDENCE}/market-information-content.png`, fullPage: true, animations: "disabled" });

  await rows.first().click();
  const detail = page.getByTestId("market-update-detail");
  await expect(detail).toContainText("Resumo de mercado BODIVA");
  await expect(detail.getByRole("link", { name: /BAIAAAAA/ })).toBeVisible();
  await expect(detail.getByRole("link", { name: /BCGAAAAA/ })).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: `${EVIDENCE}/market-update-detail.png`, fullPage: true, animations: "disabled" });
});

test("without updates the entry points stay hidden and the page says so", async ({ page, context }) => {
  await setScenario(context, "open");
  await page.goto("/mercado");
  await expect(page.getByTestId("market-row").first()).toBeVisible();
  await expect(page.getByTestId("market-information-summary")).toHaveCount(0);
  await page.goto("/mercado/informacao");
  await expect(page.getByTestId("market-information-empty")).toContainText("Sem informação");
  await expectAccessible(page);
  await page.screenshot({ path: `${EVIDENCE}/market-information-empty.png`, animations: "disabled" });
});

test("a failed market request offers a retry", async ({ page, context }) => {
  await setScenario(context, "updates");
  await page.route("**/api/market/snapshot**", (route) => route.abort());
  await page.goto("/mercado/informacao");
  await expect(page.getByTestId("market-information-error").getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: `${EVIDENCE}/market-information-error.png`, animations: "disabled" });
});

test("Home shows the three newest updates in the Mercado section", async ({ page, context }) => {
  await setScenario(context, "updates", true);
  await page.goto("/inicio");
  const section = page.getByTestId("home-market-updates");
  await expect(section.getByTestId("market-update-row")).toHaveCount(3);
  await expect(section.getByTestId("market-update-row").first()).toContainText("Sessão com 186 negócios");
});
