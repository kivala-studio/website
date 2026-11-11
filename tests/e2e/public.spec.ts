import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// W5 exit criteria against the demo build: public market, news, lessons and the shared portfolio.

test.use({ locale: "pt-AO" });

const INSTRUMENT = "/mercado/BFAAAAAA";
const SHARE = "/partilha/demoShareToken_0123456789abcdefg";
const REVOKED_SHARE = "/partilha/demoRevokedToken-0123456789abcde";
const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

async function seriousAxeIssues(page: Page) {
  // A value that changes rolls in over 0.25 s; axe would sample its contrast mid-animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id);
}

test("market filters and sort live in the URL and open an instrument", async ({ page }) => {
  await page.goto("/mercado");
  await expect(page.getByRole("heading", { level: 1, name: "Mercado" })).toBeVisible();
  await page.getByRole("navigation", { name: "Categoria" }).getByRole("link", { name: "Obrigações" }).click();
  await expect(page).toHaveURL(/\?categoria=obrigacoes$/);
  await page.getByRole("link", { name: /^Ordem / }).click();
  await expect(page).toHaveURL(/categoria=obrigacoes&sentido=asc$/);

  await page.goto("/mercado?categoria=acoes&ordem=nome&sentido=asc");
  await page.getByTestId("market-table").getByRole("link", { name: /BFAAAAAA/ }).click();
  await expect(page).toHaveURL(new RegExp(`${INSTRUMENT}\\?ordem=nome&sentido=asc$`));
  await expect(page.getByRole("heading", { level: 1, name: "BFAAAAAA" })).toBeVisible();
  expect((await page.request.get("/mercado/bfaaaaaa", { maxRedirects: 0 })).headers().location).toMatch(new RegExp(`${INSTRUMENT}$`));
});

test("chart arrows move between real observations and the page never asks for intraday or old history @engines", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (sent) => urls.push(new URL(sent.url()).pathname));
  await page.goto(INSTRUMENT);
  const chart = page.getByRole("slider", { name: "Histórico do preço" });
  const last = Number(await chart.getAttribute("aria-valuemax"));
  await chart.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(chart).toHaveAttribute("aria-valuenow", String(last - 1));
  await expect(chart).toHaveAttribute("aria-valuetext", /\d{4}: .*Kz/);
  await page.keyboard.press("Home");
  await expect(chart).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("instrument-price-label")).not.toBeEmpty();

  expect(urls.filter((url) => /intraday|\/functions\/v1\//.test(url))).toEqual([]);
  const id = (await (await page.request.get("/api/market/snapshot")).json()).securities.find((row: { symbol: string }) => row.symbol === "BFAAAAAA").id;
  const { points } = await (await page.request.get(`/api/market/history/${id}`)).json();
  expect(points.length).toBeGreaterThan(1);
  for (const [date] of points as [number, string][]) expect(Date.now() - date).toBeLessThan(YEAR_MS);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("an instrument shows its dated verified close and no current price @engines", async ({ page }) => {
    await page.goto(INSTRUMENT);
    await expect(page.getByTestId("instrument-price-label")).toHaveText(/^Último fecho verificado · \d{2}\/\d{2}\/\d{4}$/);
    await expect(page.getByText(/Cotação BODIVA/)).toHaveCount(0);
  });
});

test("an article renders the safe Markdown subset in Portuguese with NewsArticle data", async ({ page, request }) => {
  await page.goto("/en/noticias/fecho-da-sessao");
  const body = page.getByTestId("article-body");
  await expect(body).toHaveAttribute("lang", "pt-AO");
  await expect(body.getByRole("link", { name: "BODIVA" })).toHaveAttribute("href", "https://www.bodiva.ao/");
  await expect(body.getByText("esta ligação")).toBeVisible();
  await expect(page.locator('[href^="javascript:" i]')).toHaveCount(0);
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(data).toMatchObject({ "@type": "NewsArticle", inLanguage: "pt-AO", headline: "Fecho da sessão na BODIVA" });
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(/\/og\/news\/fecho-da-sessao\.png$/);
  expect((await request.get(new URL(image!).pathname)).headers()["content-type"]).toBe("image/png");
});

test("a share link is a bearer secret: no-store, noindex, no referrer, never sent anywhere", async ({ page, request }) => {
  for (const path of [SHARE, REVOKED_SHARE, "/partilha/curto"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(path === SHARE ? 200 : 404);
    expect(response.headers()["cache-control"], path).toContain("no-store");
    expect(response.headers()["referrer-policy"], path).toBe("no-referrer");
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
  }

  const sent: string[] = [];
  page.on("request", (request) => sent.push(request.url()));
  await page.goto(SHARE);
  await expect(page.getByTestId("shared-portfolio").getByRole("listitem")).toHaveCount(3);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect(sent.slice(1).filter((url) => url.includes("demoShareToken"))).toEqual([]);
  expect(await seriousAxeIssues(page)).toEqual([]);

  await page.goto(REVOKED_SHARE);
  await expect(page.getByTestId("share-not-found")).toBeVisible();
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("partilha");
});
