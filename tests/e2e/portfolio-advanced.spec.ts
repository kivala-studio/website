import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect as baseExpect, test } from "@playwright/test";

import { PdfPage, pdfBytes } from "../../src/domain/pdf/document";

/*
 * W12 in demo mode: named portfolios, cash, benchmark, the yearly PDF, the income calendar, the statement
 * reader and share links, each behind its plan gate (`demo-account`: free, plus, pro).
 */
test.use({ locale: "pt-AO" });
// A cold production server under every worker at once can take longer than the default 5 s to answer.
const expect = baseExpect.configure({ timeout: 15_000 });

const EVIDENCE = "docs/evidence/w12";

async function signIn(context: BrowserContext, tier: "free" | "plus" | "pro" = "plus", portfolio = "full") {
  await context.addCookies(
    [
      ["demo-account", tier],
      ["demo-scenario", "open"],
      ["demo-portfolio-scenario", portfolio],
    ].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })),
  );
}

async function openSummary(page: Page) {
  await page.goto("/carteira");
  await expect(page.getByTestId("portfolio-summary")).toBeVisible();
  await page.getByRole("tab", { name: "Resumo" }).click();
}

async function expectPaywall(page: Page) {
  await expect(page.getByTestId("upgrade-reason")).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByTestId("upgrade-reason")).toBeHidden();
}

test("free: every Plus control opens the plan dialog", async ({ page, context }) => {
  await signIn(context, "free");
  await openSummary(page);
  await page.getByTestId("book-menu").click();
  await page.getByTestId("book-new").click();
  await expectPaywall(page);
  await page.getByTestId("book-menu").click();
  await page.getByTestId("book-share").click();
  await expectPaywall(page);
  for (const id of ["cash-add", "benchmark-unlock", "report-pdf"]) {
    await page.getByTestId(id).first().click();
    await expectPaywall(page);
  }
  await page.getByTestId("csv-menu").click();
  await page.getByTestId("statement-read").click();
  await expectPaywall(page);

  await page.goto("/carteira/rendimentos");
  await page.getByTestId("income-unlock").click();
  await expectPaywall(page);
  await expect(page.getByTestId("income-totals")).toHaveCount(0);
});

test("plus: named portfolios split the ledger, and deleting one removes its records", async ({ page, context }) => {
  await signIn(context);
  await openSummary(page);
  await expect(page.getByTestId("portfolio-title")).toHaveText("Carteira");

  await page.getByTestId("book-menu").click();
  await page.getByTestId("book-new").click();
  await page.getByTestId("book-name").fill("Reforma");
  await page.getByTestId("book-save").click();
  await expect(page.getByTestId("portfolio-title")).toHaveText("Reforma");
  await expect(page.getByTestId("portfolio-empty")).toBeVisible();

  // The same name, any case, is refused.
  await page.getByTestId("book-menu").click();
  await page.getByTestId("book-new").click();
  await page.getByTestId("book-name").fill("reforma");
  await page.getByTestId("book-save").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  // A record made here belongs to this portfolio only.
  await page.getByTestId("record-purchase").click();
  await page.getByTestId("instrument-picker").getByRole("searchbox").fill("BAIAAAAA");
  await page.getByTestId("picker-row").first().click();
  await page.getByTestId("editor-quantity").fill("2");
  await page.getByTestId("editor-price").fill("96500");
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("holding-row")).toHaveCount(1);

  await page.getByTestId("book-menu").click();
  await page.getByRole("menuitemcheckbox", { name: "Principal" }).click();
  await expect(page.getByTestId("holding-row")).toHaveCount(4);
  await page.getByTestId("book-menu").click();
  await page.getByRole("menuitemcheckbox", { name: "Todas as carteiras" }).click();
  await expect(page.getByTestId("portfolio-title")).toHaveText("Todas as carteiras");
  await expect(page.getByTestId("holding-row")).toHaveCount(4);
  await page.goto("/carteira/registos");
  await expect(page.getByTestId("record-row")).toHaveCount(7);

  await page.goto("/carteira");
  await page.getByTestId("book-menu").click();
  await page.getByTestId("book-manage").click();
  await page.getByTestId("book-delete").click();
  await expect(page.getByTestId("book-delete-confirm")).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/book-delete-warning.png`, animations: "disabled" });
  await page.getByTestId("book-delete-confirm").click();
  await expect(page.getByTestId("portfolio-title")).toHaveText("Carteira");
  await page.goto("/carteira/registos");
  await expect(page.getByTestId("record-row")).toHaveCount(6);
});

test("plus: cash, benchmark and the yearly PDF", async ({ page, context }) => {
  await signIn(context);
  await openSummary(page);

  await page.getByTestId("cash-add").click();
  await page.getByTestId("cash-amount").fill("3000000");
  await page.getByTestId("cash-save").click();
  await expect(page.getByTestId("cash-editor")).toBeHidden();
  // 3 000 000 − purchases (901 500 + 507 500 + 875 875 + 190 000) + sale 194 700 + income 22 500
  await expect(page.getByTestId("cash-balance")).toHaveText(/742\s325/);

  await expect(page.getByTestId("benchmark-legend")).toBeVisible();
  await expect(page.getByTestId("benchmark-difference")).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("report-pdf").first().click()]);
  expect(download.suggestedFilename()).toMatch(/^invest-ao-relatorio-\d{4}\.pdf$/);
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
  expect(pdf.subarray(-6).toString("latin1")).toBe("%%EOF\n");

  await page.screenshot({ path: `${EVIDENCE}/summary-plus.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("plus: the income calendar marks recorded payments and records the rest", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/carteira");
  await page.getByRole("tab", { name: "Resumo" }).click();
  await page.getByTestId("income-link").click();
  await expect(page).toHaveURL(/\/carteira\/rendimentos$/);
  await expect(page.getByTestId("income-totals")).toBeVisible();
  await expect(page.getByTestId("income-reminders")).toHaveText("Os lembretes estão nas aplicações para iPhone e Android.");

  await expect(page.getByTestId("income-past").locator("[data-status=recorded]")).toHaveCount(1);
  const unrecorded = page.getByTestId("income-past").locator("[data-status=unrecorded]");
  await expect(unrecorded).toHaveCount(1);
  await expect(unrecorded).toContainText(/14\s000,00/);
  await expect(page.getByTestId("income-upcoming").getByTestId("income-row").first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/income.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await unrecorded.getByTestId("income-record").click();
  await expect(page.getByTestId("editor-price")).toHaveValue(/14\s000/);
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("income-past").locator("[data-status=unrecorded]")).toHaveCount(0);
});

test("plus: a statement PDF is read in the browser and never uploaded", async ({ page, context }) => {
  await signIn(context, "plus", "empty");
  await page.goto("/carteira");
  await expect(page.getByTestId("portfolio-empty")).toBeVisible();

  const statement = new PdfPage(595, 842);
  ["Extrato de operações", "05/03/2026 Compra BAIAAAAA 2 x 96 500,00", "10/04/2026 Venda BAIAAAAA 1 x 97 000,00"].forEach((line, index) =>
    statement.text(line, 44, 80 + index * 24, { size: 11 }),
  );
  const bytes = Buffer.from(pdfBytes([statement], "Extrato"));

  const requests: { url: string; method: string; body: Buffer | null }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method(), body: request.postDataBuffer() }));
  await page.getByTestId("statement-file").setInputFiles({ name: "extrato.pdf", mimeType: "application/pdf", buffer: bytes });
  await expect(page.getByTestId("csv-row")).toHaveCount(2);

  const origin = new URL(page.url()).origin;
  for (const request of requests) {
    expect(new URL(request.url).origin, request.url).toBe(origin);
    expect(request.body?.includes(bytes.subarray(0, 64)) ?? false, request.url).toBe(false);
    expect(request.body?.toString("latin1").includes("BAIAAAAA") ?? false, request.url).toBe(false);
  }
  expect(requests.some((request) => request.url.includes("/statement/pdf.worker.min.mjs"))).toBe(true);

  await page.getByTestId("csv-confirm").click();
  await expect(page.getByTestId("holding-row")).toHaveCount(1);
});

test("plus: a share link opens the read-only page until it is revoked", async ({ page, context, request }) => {
  await signIn(context);
  await page.goto("/carteira");
  await page.getByTestId("book-menu").click();
  await page.getByTestId("book-share").click();
  await page.getByTestId("share-new").click();
  await page.getByTestId("share-label").fill("Contabilista");
  await page.getByTestId("share-create").click();
  const url = (await page.getByTestId("share-url").textContent())!;
  expect(url).toMatch(/^https:\/\/invest\.ao\/partilha\/[A-Za-z0-9_-]{32}$/);
  await expect(page.getByTestId("share-row")).toHaveCount(1);
  await expect(page.getByTestId("share-row")).toContainText("Contabilista");

  // The token is in no storage.
  const token = url.split("/").at(-1)!;
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
  expect(stored).not.toContain(token);
  expect(JSON.stringify(await context.cookies())).not.toContain(token);

  const path = new URL(url).pathname;
  const shared = await context.newPage();
  await shared.goto(path);
  await expect(shared.getByTestId("shared-portfolio")).toBeVisible();
  await shared.close();

  await page.getByTestId("share-revoke").click();
  await expect(page.getByTestId("share-row")).toHaveCount(0);
  const cookies = (await context.cookies()).map(({ name, value }) => `${name}=${value}`).join("; ");
  expect((await request.get(path, { headers: { cookie: cookies } })).status()).toBe(404);
});
