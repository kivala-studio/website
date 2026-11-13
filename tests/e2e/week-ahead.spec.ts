import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

/*
 * W13 `/semana` in demo mode: next week's dividend dates relative to the request time (BAI held in the demo ledger,
 * BFA on the default list, Standard Bank market-only), an empty source (`empty`) and a calendar that cannot vouch
 * for the week (`unverified`).
 */
test.use({ locale: "pt-AO" });
const expect = baseExpect.configure({ timeout: 15_000 });

const EVIDENCE = "docs/evidence/w13";

async function signIn(context: BrowserContext, scenario: string, extra: [string, string][] = []) {
  await context.addCookies(
    [["demo-account", "free"], ["demo-scenario", scenario], ["demo-portfolio-scenario", "full"], ...extra].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  );
}

const serious = (violations: { id: string; impact?: string | null }[]) => violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")).map((item) => item.id);
const events = (page: Page) => page.getByTestId("week-ahead-event");

test("lists the week's sourced dates by day, related ones first", async ({ page, context }) => {
  await signIn(context, "open");
  await page.goto("/semana");
  await expect(events(page)).toHaveCount(4);
  await expect(page.getByRole("heading", { level: 1, name: "A tua semana à frente" })).toBeVisible();
  await expect(page.getByTestId("week-ahead-summary")).toContainText("2 eventos relacionados com ações na tua carteira");
  await expect(page.getByTestId("week-ahead-summary")).toContainText("1 evento relacionado com a tua lista.");
  await expect(page.getByTestId("week-ahead-day")).toHaveCount(4);
  await expect(page.getByTestId("week-ahead-day").first().getByRole("heading")).toHaveText(/^Segunda-feira · /);

  await expect(events(page).filter({ hasText: "Banco Angolano de Investimentos" }).first()).toHaveAttribute("data-relationship", "portfolio");
  await expect(events(page).filter({ hasText: "Banco de Fomento Angola" })).toHaveAttribute("data-relationship", "watchlist");
  // The issuer also has a bond; a dividend never relates it.
  await expect(events(page).filter({ hasText: "Standard Bank de Angola" })).toHaveAttribute("data-relationship", "market");

  const first = events(page).first();
  await expect(first).toContainText("Data ex-dividendo · Banco Angolano de Investimentos");
  await expect(first).toContainText("Hora não anunciada");
  await expect(first).toContainText("Data anunciada");
  await expect(first).toContainText("Relacionado com ações na tua carteira");
  await expect(first).toContainText("Exercício de 2025");
  await expect(first).toContainText("Data de publicação da fonte não disponibilizada");
  await expect(first.getByRole("link", { name: /Fonte: www\.bodiva\.ao/ })).toHaveAttribute("href", "https://www.bodiva.ao/");
  await expect(page.getByRole("heading", { name: "Sobre esta agenda" })).toBeVisible();

  await page.screenshot({ path: `${EVIDENCE}/week-ahead-content.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("privacy mode removes every relationship", async ({ page, context }) => {
  await signIn(context, "open", [["investao-privacy", "on"]]);
  await page.goto("/semana");
  await expect(events(page)).toHaveCount(4);
  await expect(page.getByTestId("week-ahead-summary")).toHaveText("4 eventos anunciados para a próxima semana");
  await expect(page.getByText("Relacionado com", { exact: false })).toHaveCount(0);
});

test("an empty source says so without claiming there is nothing", async ({ page, context }) => {
  await signIn(context, "empty");
  await page.goto("/semana");
  await expect(page.getByText("Sem eventos verificados para este período")).toBeVisible();
  await expect(page.getByText("A ausência de eventos nesta agenda não confirma que não existam outros anúncios.")).toBeVisible();
  await expect(events(page)).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCE}/week-ahead-empty.png`, fullPage: true });
  // The shared state title is an h3 straight under the page h1 (moderate, as on Home and the simulator).
  expect(serious((await new AxeBuilder({ page }).analyze()).violations)).toEqual([]);
});

test("an unverified calendar withholds the whole week", async ({ page, context }) => {
  await signIn(context, "unverified");
  await page.goto("/semana");
  await expect(page.locator("main").getByRole("alert")).toContainText("Agenda indisponível");
  await expect(page.locator("main").getByRole("alert")).toContainText("Não foi possível confirmar dados atuais para este período.");
  await expect(events(page)).toHaveCount(0);
  await expect(page.getByTestId("week-ahead-summary")).toHaveCount(0);

  // Retrying reads again; the week stays withheld while the calendar cannot vouch for it.
  const request = page.waitForRequest((sent) => sent.url().endsWith("/api/account/week-ahead"));
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await request;
  await expect(page.locator("main").getByRole("alert")).toContainText("Agenda indisponível");
  await page.screenshot({ path: `${EVIDENCE}/week-ahead-unavailable.png`, fullPage: true });
  // The shared state title is an h3 straight under the page h1 (moderate, as on Home and the simulator).
  expect(serious((await new AxeBuilder({ page }).analyze()).violations)).toEqual([]);
});
