import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect, test } from "@playwright/test";

/*
 * W11 in demo mode: the dashboard over the demo ledger (`demo-portfolio-scenario`: full, partial, empty,
 * invalid), valued at the demo's current quotes; the editor's inline rules; records; CSV round trip; privacy.
 */
test.use({ locale: "pt-AO" });

const EVIDENCE = "docs/evidence/w11";
const BAI = "3c55bf40-8544-4598-bf76-15a165dbeff3";

async function signIn(context: BrowserContext, portfolio = "full", market = "open") {
  await context.addCookies(
    [
      ["demo-account", "plus"],
      ["demo-scenario", market],
      ["demo-portfolio-scenario", portfolio],
    ].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })),
  );
}

const spaced = (text: string | null) => (text ?? "").replace(/\s/g, " ");

async function openDashboard(page: Page) {
  await page.goto("/carteira");
  await expect(page.getByTestId("portfolio-summary")).toBeVisible();
}

test("full: totals equal the calculator's output at current quotes", async ({ page, context }) => {
  await signIn(context);
  await openDashboard(page);
  // 10 × 96 500 + 500 000 × 108 % + 40 × 19 001 + 2 × 100 000
  await expect(page.getByTestId("portfolio-summary")).toHaveAttribute("data-value-state", "full");
  expect(spaced(await page.getByTestId("portfolio-value").textContent())).toBe("2 465 040,00 Kz");
  await expect(page.getByTestId("holding-row")).toHaveCount(4);
  await expect(page.getByTestId("holding-row").first()).toContainText("BAIAAAAA");

  await page.getByRole("tab", { name: "Resumo" }).click();
  const metrics = page.getByTestId("portfolio-metrics");
  expect(spaced(await metrics.textContent())).toContain("Valor investido2 299 700 Kz");
  expect(spaced(await metrics.textContent())).toContain("+165 340 Kz");
  await expect(page.getByRole("heading", { name: "Resultados por ano" })).toBeVisible();

  await page.getByRole("tab", { name: "Distribuição" }).click();
  await expect(page.getByTestId("allocation").getByRole("listitem")).toHaveCount(4);

  await page.screenshot({ path: `${EVIDENCE}/dashboard-shown.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the dashboard says when values are partial, unavailable or the ledger is invalid", async ({ page, context }) => {
  await signIn(context, "partial");
  await openDashboard(page);
  await expect(page.getByTestId("portfolio-summary")).toHaveAttribute("data-value-state", "partial");
  await expect(page.getByText("Valor parcial da carteira")).toBeVisible();
  await expect(page.getByText("1 instrumento sem cotação atual")).toBeVisible();

  await signIn(context, "full", "stale");
  await openDashboard(page);
  // A stale quote is not current: nothing is valued.
  await expect(page.getByTestId("portfolio-summary")).toHaveAttribute("data-value-state", "unavailable");
  await expect(page.getByText("Valor da carteira indisponível")).toBeVisible();

  await context.clearCookies({ name: "demo-portfolio" });
  await signIn(context, "invalid");
  await page.goto("/carteira");
  await expect(page.getByTestId("portfolio-invalid")).toBeVisible();
});

test("records a first purchase from the empty state", async ({ page, context }) => {
  await signIn(context, "empty");
  await page.goto("/carteira");
  await expect(page.getByTestId("portfolio-empty")).toBeVisible();
  await page.getByTestId("record-purchase").click();
  await page.getByTestId("instrument-picker").getByRole("searchbox").fill("BAIAAAAA");
  await page.getByTestId("picker-row").first().click();
  await page.getByTestId("editor-quantity").fill("2");
  await page.getByTestId("editor-price").fill("95000");
  await expect(page.getByTestId("editor-total")).toContainText("190 000,00 Kz");
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("holding-row")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("holding-row")).toHaveCount(1);
});

test("the editor shows the server's rules inline", async ({ page, context }) => {
  await signIn(context);
  await page.goto(`/carteira/${BAI}`);
  await page.getByTestId("record-menu").click();
  await page.getByTestId("record-sell").click();
  const editor = page.getByTestId("transaction-editor");
  await page.getByTestId("editor-quantity").fill("1,5");
  await page.getByTestId("editor-price").fill("0");
  await page.getByTestId("editor-date").fill("2099-01-01");
  await page.getByTestId("editor-save").click();
  await expect(editor.getByText("A quantidade deste instrumento deve ser um número inteiro.")).toBeVisible();
  await expect(editor.getByText("Introduz um preço por unidade superior a zero.")).toBeVisible();
  await expect(editor.getByText("A data do registo não pode estar no futuro.")).toBeVisible();

  await page.getByTestId("editor-quantity").fill("20");
  await page.getByTestId("editor-price").fill("100000");
  await page.getByTestId("editor-date").fill("2026-11-02");
  await page.getByTestId("editor-save").click();
  await expect(editor.getByText("A venda excede a quantidade que tinhas nessa data.")).toBeVisible();

  await page.getByTestId("editor-quantity").fill("2");
  await page.getByTestId("editor-save").click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByTestId("position-metrics")).toContainText("8");
  await expect(page.getByTestId("record-row")).toHaveCount(3);
});

test("records can be edited and deleted", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/carteira/registos");
  const rows = page.getByTestId("record-row");
  await expect(rows).toHaveCount(6);
  const newest = rows.first();
  await expect(newest).toContainText("BDVAAAAA");
  await newest.getByRole("button", { name: "Opções" }).click();
  await page.getByRole("menuitem", { name: "Editar registo" }).click();
  await page.getByTestId("editor-quantity").fill("3");
  await page.getByTestId("editor-save").click();
  await expect(rows.first()).toContainText("3 ações");

  await rows.first().getByRole("button", { name: "Opções" }).click();
  await page.getByRole("menuitem", { name: "Eliminar registo" }).click();
  await page.getByTestId("confirm-delete").click();
  await expect(rows).toHaveCount(5);
});

test("an exported ledger imports unchanged into an empty one", async ({ page, context }) => {
  await signIn(context);
  await openDashboard(page);
  await page.getByTestId("csv-menu").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("csv-export").click()]);
  expect(download.suggestedFilename()).toBe("invest-ao-carteira.csv");
  const exported = await readFile((await download.path())!, "utf8");
  expect(exported.split("\r\n")[0]).toBe("data;simbolo;instrumento;tipo;quantidade;preco;custos;valor_liquido;moeda");

  await context.clearCookies({ name: "demo-portfolio" });
  await signIn(context, "empty");
  await page.goto("/carteira");
  await expect(page.getByTestId("portfolio-empty")).toBeVisible();
  await page.getByTestId("csv-menu").click();
  await page.getByTestId("csv-file").setInputFiles({ name: "invest-ao-carteira.csv", mimeType: "text/csv", buffer: Buffer.from(exported) });
  await expect(page.getByTestId("csv-row")).toHaveCount(6);
  await page.getByTestId("csv-confirm").click();
  await expect(page.getByTestId("holding-row")).toHaveCount(4);

  await page.getByTestId("csv-menu").click();
  const [again] = await Promise.all([page.waitForEvent("download"), page.getByTestId("csv-export").click()]);
  expect(await readFile((await again.path())!, "utf8")).toBe(exported);
});

test("privacy mode hides every amount and orders holdings by id", async ({ page, context }) => {
  await signIn(context);
  await context.addCookies([{ name: "investao-privacy", value: "on", domain: "localhost", path: "/" }]);
  await openDashboard(page);
  await expect(page.getByTestId("portfolio-value")).toHaveCount(0);
  await expect(page.getByTestId("portfolio-private-trend")).toBeVisible();
  await expect(page.getByTestId("portfolio-chart")).toHaveCount(0);
  const symbols = await page.getByTestId("holding-symbol").allTextContents();
  // By instrument id: 3c55… BAI, 51399… BDVA, 59c63… BAIODOFA, ec708… BCGA.
  expect(symbols).toEqual(["BAIAAAAA", "BDVAAAAA", "BAIODOFA", "BCGAAAAA"]);
  expect(await page.getByTestId("portfolio").textContent()).not.toMatch(/\d\sKz/);
  await page.screenshot({ path: `${EVIDENCE}/dashboard-hidden.png`, fullPage: true });

  await page.goto(`/carteira/${BAI}`);
  await expect(page.getByTestId("position-value")).toHaveCount(0);
  // The public price stays visible.
  await expect(page.getByTestId("position-metrics")).toContainText("96 500,00 Kz");
});

test("the dashboard has two columns on desktop and one on phones", async ({ page, context }) => {
  await signIn(context);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDashboard(page);
  const summary = await page.getByTestId("portfolio-summary").boundingBox();
  const holdings = await page.getByTestId("holdings").boundingBox();
  expect(holdings!.x).toBeGreaterThan(summary!.x + summary!.width);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(async () => {
    const [top, below] = [await page.getByTestId("portfolio-summary").boundingBox(), await page.getByTestId("holdings").boundingBox()];
    expect(below!.y).toBeGreaterThan(top!.y + top!.height);
  }).toPass();
  await page.screenshot({ path: `${EVIDENCE}/dashboard-phone.png`, fullPage: true });
});
