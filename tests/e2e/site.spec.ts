import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Portuguese is the default locale; without this, locale detection sends the browser to /en.
test.use({ locale: "pt-AO" });

const PAGES = [
  "/",
  "/policy",
  "/termos",
  "/suporte",
  "/eliminar-conta",
  "/convite/ABCD2345",
  "/mercado",
  "/mercado/BFAAAAAA",
  "/mercado/OH15S28A",
  "/noticias",
  "/noticias/fecho-da-sessao",
  "/aprender",
  "/aprender/acoes",
];
const localized = (path: string) => [path, path === "/" ? "/en" : `/en${path}`];
/** Functional cookies only: the saved theme and next-intl's language choice. */
const FUNCTIONAL_COOKIES = ["theme", "NEXT_LOCALE"];

async function seriousAxeIssues(page: Page) {
  // A value that changes rolls in over 0.25 s; axe would sample its contrast mid-animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id);
}

test("every public page returns 200 in pt and en with the security headers and nonced scripts", async ({ request }) => {
  for (const path of PAGES.flatMap(localized)) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const headers = response.headers();
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    const nonce = headers["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
    expect(nonce, path).toBeTruthy();
    const html = await response.text();
    for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) expect(tag, path).toContain(`nonce="${nonce}"`);
    expect(html, path).not.toMatch(/<[a-z]+\b[^>]*\sstyle="/);
  }
});

test("/policy keeps its exact path and the landing page carries Organization data", async ({ page }) => {
  const policy = await page.goto("/policy");
  expect(policy?.url()).toMatch(/\/policy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidade");
  await expect(page.locator("[data-draft]")).toBeVisible();
  await expect(page.getByRole("link", { name: "suporte@invest.ao" })).toHaveAttribute("href", "mailto:suporte@invest.ao");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/policy$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/policy$/);

  await page.goto("/");
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(data).toMatchObject({ "@type": "Organization", name: "invest.ao", sameAs: ["https://apps.apple.com/app/id6812907673"] });
  await expect(page.getByRole("link", { name: "Descarregar na App Store" }).first()).toHaveAttribute(
    "href",
    "https://apps.apple.com/app/id6812907673",
  );
  await expect(page.getByRole("link", { name: "Iniciar sessão" })).toHaveAttribute("href", "/entrar");
});

for (const theme of ["light", "dark"] as const) {
  test(`public pages have no CSP errors, no serious axe issues and only functional cookies (${theme})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "theme", value: theme, url: baseURL! }]);
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const path of [...PAGES, "/en", "/en/eliminar-conta", "/nada"]) {
      await page.goto(path);
      expect(await seriousAxeIssues(page), path).toEqual([]);
    }
    expect(errors.filter((error) => /Content Security Policy/i.test(error))).toEqual([]);
    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names.filter((name) => !FUNCTIONAL_COOKIES.includes(name))).toEqual([]);
  });
}

test("language and theme switches work from the keyboard", async ({ page, context }) => {
  await page.goto("/policy");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "invest.ao, início" })).toBeFocused();
  for (const section of ["Mercado", "Notícias", "Aprender"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: section, exact: true })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  const english = page.getByRole("link", { name: "English" });
  await expect(english).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/policy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");

  const theme = page.getByRole("radiogroup", { name: "Theme" });
  await theme.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await context.cookies()).find((cookie) => cookie.name === "theme")?.value).toBe("dark");
});

test("invite links validate the code, keep it in the tab and never send it to another host", async ({ page, request }) => {
  for (const path of ["/convite/ABCD1234", "/convite/ABCDOI23", "/convite/ABCD234", "/en/convite/abcd-234"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }

  const hosts = new Set<string>();
  page.on("request", (sent) => hosts.add(new URL(sent.url()).host));
  await page.goto("/convite/abcd2345");
  await expect(page.getByText("ABCD2345", { exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  await expect(page).toHaveTitle("Código de convite · invest.ao");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("investao.inviteCode"))).toBe("ABCD2345");
  expect([...hosts]).toEqual([new URL(page.url()).host]);
});

test("unknown pages render the translated 404", async ({ page }) => {
  for (const [path, title] of [["/nada", "Página não encontrada"], ["/en/nada", "Page not found"]]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
});

test("sitemap lists only the public indexable pages; robots points to it", async ({ request, baseURL }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url.replace(baseURL!, ""));
  const fixed = ["/", "/policy", "/termos", "/suporte", "/eliminar-conta", "/mercado", "/noticias", "/aprender"];
  expect(urls.filter((url) => !/^(\/en)?\/(mercado|noticias|aprender)\/./.test(url)).sort()).toEqual(
    fixed.flatMap((path) => [path, path === "/" ? "/en" : `/en${path}`]).sort(),
  );
  for (const path of ["/mercado/BFAAAAAA", "/en/mercado/BFAAAAAA", "/aprender/acoes", "/noticias/fecho-da-sessao"]) expect(urls).toContain(path);
  expect(urls.filter((url) => /partilha|convite|entrar|\/dev\//.test(url))).toEqual([]);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  expect(robots).toContain("Disallow: /dev/");
});

test("assetlinks.json is valid JSON with the JSON content type, and Open Graph images are PNGs", async ({ request }) => {
  const links = await request.get("/.well-known/assetlinks.json");
  expect(links.status()).toBe(200);
  expect(links.headers()["content-type"]).toMatch(/^application\/json/);
  expect(await links.json()).toEqual([]);

  for (const path of ["/og/pt-home.png", "/og/en-policy.png"]) {
    const image = await request.get(path);
    expect(image.headers()["content-type"], path).toBe("image/png");
  }
});
