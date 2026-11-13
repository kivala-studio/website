import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

/* W13 `/simulador` in demo mode: the calculator on live demo quotes, then the no-quotes and failed states. */
// Chips and presets animate their colours; axe must see the settled state.
test.use({ locale: "pt-AO", reducedMotion: "reduce" });
const expect = baseExpect.configure({ timeout: 15_000 });

const EVIDENCE = "docs/evidence/w13";

async function signIn(context: BrowserContext, scenario = "open") {
  await context.addCookies(
    [
      ["demo-account", "plus"],
      ["demo-scenario", scenario],
    ].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })),
  );
}

const row = (page: Page, field: string) => page.getByTestId(`scenario-${field}`);

async function expectAccessible(page: Page) {
  // The shared empty and error states put their title at h3 straight under the page h1 (moderate, as on Home).
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([]);
}

test("projects whole shares bought at the demo quote, with the methodology and both disclaimers", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/simulador");
  await expect(page.getByTestId("simulation-value")).toHaveText("— Kz");
  await page.getByTestId("simulation-choose").click();
  const picker = page.getByTestId("simulation-picker");
  await picker.getByRole("searchbox").fill("BAI");
  await picker.getByTestId("picker-row").first().click();
  await expect(page.getByTestId("simulation-instrument")).toContainText("BAI");

  // 1 000 000 Kz now, nothing monthly, 0 % a year, 1 year: 10 shares at 96 500 Kz and 35 000 Kz left over.
  await row(page, "initialInvestment").getByRole("button").nth(3).click();
  await row(page, "durationMonths").getByRole("button", { name: "1 ano" }).click();
  await expect(page.getByTestId("simulation-value")).toHaveText(/^1\s000\s000,00\sKz$/);
  const position = page.getByTestId("simulation-position");
  await expect(position).toContainText("Unidades iniciais10");
  await expect(position).toContainText(/Saldo não aplicado35\s000,00\sKz/);
  await expect(page.getByTestId("simulation-chart")).toBeVisible();

  // 10 % a year for 5 years with 10 000 Kz a month: the gain line follows.
  await row(page, "monthlyContribution").getByRole("button").nth(1).click();
  await row(page, "annualReturnPercent").getByRole("button", { name: "+10%" }).click();
  await row(page, "durationMonths").getByRole("button", { name: "5 anos" }).click();
  await expect(page.getByTestId("simulation-gain")).toContainText("de 1 600 000,00 Kz investidos".replaceAll(" ", " ").replace(" de ", " de "));

  // An invalid rate removes the projection and says why under the field.
  await row(page, "annualReturnPercent").getByRole("textbox").fill("-100");
  await row(page, "annualReturnPercent").getByRole("textbox").blur();
  await expect(row(page, "annualReturnPercent")).toContainText("Introduza uma taxa superior a −100% e até 100%.");
  await expect(page.getByTestId("simulation-value")).toHaveText("— Kz");
  await row(page, "annualReturnPercent").getByRole("button", { name: "+10%" }).click();

  await expect(page.getByTestId("simulation-quote-footnote")).toContainText("Cotação consultada no servidor. Não é um preço de execução garantido.");
  await page.getByTestId("simulation-methodology").locator("summary").click();
  await expect(page.getByTestId("simulation-methodology")).toContainText("Não a inferimos do desempenho passado.");
  await expectAccessible(page);
  await page.screenshot({ path: `${EVIDENCE}/simulator-content.png`, fullPage: true, animations: "disabled" });

  // The draft survives a reload in the same tab.
  await page.reload();
  await expect(page.getByTestId("simulation-instrument")).toContainText("BAI");
  await expect(row(page, "annualReturnPercent").getByRole("textbox")).toHaveValue("10");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("simulation-chart")).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/simulator-content-phone.png`, fullPage: true, animations: "disabled" });
});

test("without a current quote there is nothing to simulate", async ({ page, context }) => {
  await signIn(context, "stale");
  await page.goto("/simulador");
  await expect(page.getByTestId("simulation-empty")).toContainText("Sem cotações atuais para simular");
  await expectAccessible(page);
  await page.screenshot({ path: `${EVIDENCE}/simulator-empty.png`, animations: "disabled" });
});

test("a failed quote request offers a retry", async ({ page, context }) => {
  await signIn(context);
  await page.route("**/api/market/snapshot**", (route) => route.abort());
  await page.goto("/simulador");
  await expect(page.getByTestId("simulation-error")).toContainText("Cotações indisponíveis");
  await expect(page.getByTestId("simulation-error").getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: `${EVIDENCE}/simulator-error.png`, animations: "disabled" });
});
