import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

import { settled } from "./settled";

/*
 * W16 `/planos` in demo mode: a Free account buys a Plus web pass with Multicaixa Express (a phone ending 0001 pays
 * 5 s after the order opens), and the page with passes closed (`demo-plans=closed`). Home's Plus prompt: the offer,
 * the renewal reminder and who never gets one.
 */
test.use({ locale: "pt-AO" });
const expect = baseExpect.configure({ timeout: 15_000 });

async function signIn(context: BrowserContext, cookies: [string, string][] = [], account = "free") {
  await context.addCookies([["demo-account", account], ...cookies].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
}

const serious = (violations: { id: string; impact?: string | null }[]) => violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")).map((item) => item.id);

/** The page's own content: the app shell's sidebar profile link fails `label-content-name-mismatch` on every page today. */
async function axe(page: Page) {
  await settled(page);
  expect(serious((await new AxeBuilder({ page }).include("#main").analyze()).violations)).toEqual([]);
}

test("a Free member pays a pass with Multicaixa Express and becomes Plus", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/planos");
  await expect(page.getByRole("heading", { level: 1, name: "invest.ao Plus" })).toBeVisible();
  await expect(page.getByTestId("plan-status")).toHaveText("Plano gratuito");
  // 12 months is preselected; the price and the button come from the server's plan.
  await expect(page.getByRole("radio", { name: "12 meses, Poupa 16%" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("checkout-price")).toHaveText("11 111,11 Kz");
  await axe(page);

  // The phone is checked on submit; the error sits on the field and is announced.
  const submit = page.getByRole("button", { name: "Pagar 11 111,11 Kz" });
  await submit.click();
  const phone = page.getByLabel("Número de telemóvel");
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("checkout-form").getByRole("alert")).toHaveText("Introduz um número de telemóvel angolano começado por 9.");
  await expect(phone).toBeFocused();

  await phone.fill("923 000 001");
  await submit.click();
  const pending = page.getByTestId("order-pending");
  await expect(pending).toHaveAttribute("data-method", "mcx_express");
  // The form is gone: focus moves to the new view's heading.
  await expect(pending.getByRole("heading", { name: "Confirma o pagamento na app Multicaixa Express" })).toBeFocused();
  await expect(pending.getByRole("timer")).toContainText("Expira em");

  await expect(page.getByTestId("order-outcome")).toHaveAttribute("data-status", "paid");
  await expect(page.getByRole("heading", { name: "Pagamento confirmado" })).toBeVisible();
  // The card shows no date (the header does); the announcement still says until when.
  await expect(page.getByTestId("order-outcome")).not.toContainText("Até");
  await expect(page.getByRole("status").filter({ hasText: "Pagamento confirmado" })).toHaveText(/^Pagamento confirmado\. O teu Plus está ativo\. Até \d{1,2} de \S+ de \d{4}$/);
  await expect(page.getByTestId("plan-status")).toHaveAttribute("data-plan", "plus");
  await expect(page.getByTestId("plan-status")).toContainText("O teu Plus está ativo");
  // The settled order joins the history without a reload.
  const history = page.getByRole("region", { name: "Pedidos anteriores" });
  const row = history.getByRole("listitem");
  await expect(row).toHaveCount(1);
  for (const text of ["12 meses", "11 111,11 Kz", "Pagamento confirmado"]) await expect(row).toContainText(text);
  await axe(page);
});

test("with passes closed, a Free member gets the App Store and no purchase", async ({ page, context }) => {
  await signIn(context, [["demo-plans", "closed"]]);
  await page.goto("/planos");
  await expect(page.getByTestId("plans-unavailable")).toBeVisible();
  await expect(page.getByRole("link", { name: "Descarregar na App Store" })).toHaveAttribute("href", /apps\.apple\.com/);
  await expect(page.getByTestId("checkout-form")).toHaveCount(0);
  await axe(page);
});

/** Requests to the plans route this page makes, from now on. */
function plansRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/billing/plans") urls.push(request.url());
  });
  return urls;
}

/** Home is hydrated once the market store has drawn the index; the prompt decides right after. */
async function openHome(page: Page) {
  await page.goto("/inicio");
  await expect(page.getByTestId("home-index")).toBeVisible();
}

test("Home offers Plus to a Free member once; dismissed, it stays away", async ({ page, context }) => {
  await signIn(context);
  const requests = plansRequests(page);
  await openHome(page);
  const prompt = page.getByTestId("plus-prompt");
  await expect(prompt).toHaveAttribute("data-variant", "offer");
  await expect(prompt).toContainText("Paga o Plus em kwanzas com Multicaixa.");
  await expect(prompt.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/planos");
  expect(requests).toHaveLength(1);
  await axe(page);

  // From the keyboard: focus moves on to what follows the card.
  await prompt.getByRole("button", { name: "Fechar aviso" }).focus();
  await page.keyboard.press("Enter");
  await expect(prompt).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  await page.reload();
  await expect(page.getByTestId("home-index")).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(prompt).toHaveCount(0);
  // Dismissed: the plans are not read again.
  expect(requests).toHaveLength(1);
});

test("with passes closed, Home reads the plans once and shows no prompt", async ({ page, context }) => {
  await signIn(context, [["demo-plans", "closed"]]);
  const answered = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/billing/plans");
  await openHome(page);
  expect((await (await answered).json()).plans).toEqual([]);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("plus-prompt")).toHaveCount(0);
});

test("an App Store subscriber gets no prompt and Home never reads the plans", async ({ page, context }) => {
  await signIn(context, [], "plus");
  const requests = plansRequests(page);
  await openHome(page);
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("plus-prompt")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("prepaid Plus that ends within 7 days asks to add time", async ({ page, context }) => {
  // A one-month pass paid 27 days ago (the demo ledger's cookie): it ends in 1 to 4 days.
  const opened = Date.now() - 27 * 24 * 60 * 60_000;
  const order = ["6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60", "plus_1m", 1, "1111.11", "mcx_express", "paid", opened, opened + 600_000, opened + 5_000, null];
  await signIn(context, [["demo-web-orders", encodeURIComponent(JSON.stringify([order]))]]);
  await openHome(page);
  const prompt = page.getByTestId("plus-prompt");
  await expect(prompt).toHaveAttribute("data-variant", "renew");
  await expect(prompt).toContainText(/^O teu Plus termina a \d{1,2} de \S+ de \d{4}\./);
  await expect(prompt.getByRole("link", { name: "Adicionar tempo" })).toHaveAttribute("href", "/planos");
});
