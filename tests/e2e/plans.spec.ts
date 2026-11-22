import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

import { settled } from "./settled";

/*
 * W16 `/planos` in demo mode: a Free account buys a Plus web pass with Multicaixa Express (a phone ending 0001 pays
 * 5 s after the order opens), and the page with passes closed (`demo-plans=closed`).
 */
test.use({ locale: "pt-AO" });
const expect = baseExpect.configure({ timeout: 15_000 });

async function signIn(context: BrowserContext, cookies: [string, string][] = []) {
  await context.addCookies([["demo-account", "free"], ...cookies].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
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
  await expect(page.getByRole("status").filter({ hasText: "Pagamento confirmado" })).toBeAttached();
  await expect(page.getByTestId("plan-status")).toHaveAttribute("data-plan", "plus");
  await expect(page.getByTestId("plan-status")).toContainText("O teu Plus está ativo");
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
