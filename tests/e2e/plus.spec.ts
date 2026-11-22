import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect, test } from "@playwright/test";

import { settled } from "./settled";

/*
 * W16 `/plus` in demo mode: the passes on sale (the demo's placeholder prices) and the page with passes closed
 * (`demo-plans=closed`); and the pages the iOS app and the store listings open, which never link to `/plus` or name a
 * price (App Store rules).
 */
test.use({ locale: "pt-AO" });

/** The demo passes' prices in either language's format (1 111,11 Kz · AOA 1,111.11 and the 12-month one). */
const DEMO_PRICE = /1[\s  .,]?111[.,]11/;
const STORE_LINKED = ["/policy", "/termos", "/suporte", "/eliminar-conta"];

async function closePasses(context: BrowserContext) {
  await context.addCookies([{ name: "demo-plans", value: "closed", domain: "localhost", path: "/" }]);
}

async function seriousAxeIssues(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id);
}

test("/plus shows both passes with their prices, the saving and the way to pay", async ({ page }) => {
  await page.goto("/plus");
  await expect(page.getByRole("heading", { level: 1, name: "invest.ao Plus" })).toBeVisible();
  await expect(page.getByTestId("plus-price")).toHaveText(["1 111,11 Kz", "11 111,11 Kz"]);
  await expect(page.getByTestId("plus-pass").nth(1)).toContainText("Poupa 16%");
  await expect(page.getByText("Paga com Multicaixa Express ou por referência.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar com o Plus" })).toHaveAttribute("href", /\/planos$/);
  await expect(page.getByRole("table", { name: "O que o Plus inclui" }).getByRole("rowheader")).toHaveCount(14);
  await expect(page.getByRole("link", { name: "Descarregar na App Store" })).toHaveAttribute("href", /apps\.apple\.com/);
  await expect(page.getByRole("banner").getByRole("link", { name: "Plus", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await seriousAxeIssues(page)).toEqual([]);

  await page.goto("/en/plus");
  await expect(page.getByTestId("plus-price")).toHaveText([/^AOA\s1,111\.11$/, /^AOA\s11,111\.11$/]);
  await expect(page.getByRole("link", { name: "Continue with Plus" })).toHaveAttribute("href", /\/en\/planos$/);
});

test("with passes closed, /plus names no price and no payment but keeps the comparison and the App Store", async ({ page, context }) => {
  await closePasses(context);
  await page.goto("/plus");
  await expect(page.getByRole("heading", { level: 1, name: "invest.ao Plus" })).toBeVisible();
  await expect(page.getByTestId("plus-pass")).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText(DEMO_PRICE);
  await expect(page.getByRole("main")).not.toContainText("Multicaixa");
  await expect(page.getByRole("link", { name: "Continuar com o Plus" })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "O que o Plus inclui" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Descarregar na App Store" })).toHaveAttribute("href", /apps\.apple\.com/);
  expect(await seriousAxeIssues(page)).toEqual([]);
});

test("the pages the app and the stores open never link to /plus or name a price; the rest of the site does link to it", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Plus", exact: true })).toHaveAttribute("href", "/plus");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Plus", exact: true })).toHaveAttribute("href", "/plus");

  for (const path of STORE_LINKED.flatMap((path) => [path, `/en${path}`])) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(/href="[^"]*\/plus"/);
    expect(html, path).not.toMatch(DEMO_PRICE);
  }
  for (const path of ["/policy", "/en/policy"]) {
    await page.goto(path);
    await expect(page.locator('a[href$="/plus"]'), path).toHaveCount(0);
    await expect(page.getByRole("contentinfo"), path).not.toContainText("Plus");
  }
});
