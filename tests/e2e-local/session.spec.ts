import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

/**
 * Sessions against the local stack seeded by backend B0. The seed's password comes from CLIENT_DEV_PASSWORD;
 * nothing here signs in anywhere else.
 */
const password = process.env.CLIENT_DEV_PASSWORD ?? "";
test.skip(!password, "CLIENT_DEV_PASSWORD is not set");

const FREE = "free@example.test";
const PLUS = "plus@example.test";
const PRO = "pro@example.test";

async function signIn(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(password);
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
}

/** First sign-in of a seeded account shows setup; skipping it leads to the page that was asked for. */
async function skipSetupIfShown(page: Page) {
  const name = page.getByTestId("setup-name");
  const app = page.getByRole("navigation", { name: "Navegação principal" }).first();
  await expect(name.or(app)).toBeVisible();
  if (!(await name.isVisible())) return;
  await page.getByRole("button", { name: "Agora não" }).click();
  await page.getByRole("button", { name: "Fazer isto mais tarde" }).click();
  await expect(app).toBeVisible();
}

const sessionCookies = async (page: Page) => (await page.context().cookies()).filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));

test("deep link, sign-in, reload, shell, sign-out and the back button", async ({ page }) => {
  await page.goto("/carteira");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fcarteira$/);
  await signIn(page, FREE);
  await expect(page).toHaveURL(/\/carteira$/);
  await skipSetupIfShown(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carteira");

  const cookies = await sessionCookies(page);
  expect(cookies.length).toBeGreaterThan(0);
  for (const cookie of cookies) {
    expect(cookie.httpOnly, cookie.name).toBe(true);
    expect(cookie.sameSite, cookie.name).toBe("Lax");
    expect(cookie.path, cookie.name).toBe("/");
  }

  const reloaded = await page.reload();
  expect(reloaded?.headers()["cache-control"]).toMatch(/private.*no-store|no-store.*private/);
  await expect(page).toHaveURL(/\/carteira$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carteira");

  // The shell: current tab announced, everything reachable with the keyboard.
  const sidebar = page.getByRole("navigation", { name: "Navegação principal" }).first();
  await expect(sidebar.getByRole("link", { name: "Carteira" })).toHaveAttribute("aria-current", "page");
  const reached = new Set<string>();
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return element?.getAttribute("aria-label") ?? element?.querySelector(".sr-only")?.textContent ?? element?.textContent?.trim() ?? "";
    });
    reached.add(label);
  }
  for (const label of ["Início", "Explorar", "Carteira", "Lista", "Pesquisa"]) expect([...reached].some((value) => value.includes(label)), label).toBe(true);
  expect([...reached].some((value) => value.startsWith("Perfil"))).toBe(true);
  expect([...reached].some((value) => value.startsWith("Atividade,"))).toBe(true);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([]);

  await page.goto("/definicoes");
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect(await sessionCookies(page)).toEqual([]);

  await page.goBack();
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByRole("link", { name: /^Perfil/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Iniciar sessão");
});

test("setup resumes after a reload and adds the first watchlist", async ({ page }) => {
  await page.goto("/lista");
  await signIn(page, PLUS);
  await expect(page).toHaveURL(/\/lista$/);
  const name = page.getByTestId("setup-name");
  const app = page.getByRole("navigation", { name: "Navegação principal" }).first();
  await expect(name.or(app)).toBeVisible();
  test.skip(!(await name.isVisible()), "plus@ already finished setup; reseed the local stack to run this again");

  await name.fill("Ana Plus");
  await page.reload();
  await expect(name).toHaveValue("Ana Plus");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O que queres acompanhar de perto?");

  // Pick the first instrument not yet watched, find it again by search, and keep the choice across a reload.
  const free = page.locator("main li button:not([disabled])").first();
  const symbol = (await free.locator("span.font-semibold").first().textContent())?.trim() ?? "";
  expect(symbol).not.toBe("");
  await page.getByRole("searchbox").fill(symbol);
  const row = page.locator("main li button").filter({ hasText: symbol }).first();
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "1" })).toBeVisible();
  await page.reload();
  await expect(page.locator("main li button").filter({ hasText: symbol }).first()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Adicionar e continuar" }).click();
  await expect(app).toBeVisible();
  await expect(page.getByRole("link", { name: "Perfil de Ana Plus" })).toContainText("AP");
});

test("next never leaves the site", async ({ page, request }) => {
  await page.goto("/entrar?next=https%3A%2F%2Fevil.example%2Fsteal");
  await signIn(page, PRO);
  await skipSetupIfShown(page);
  await expect(page).toHaveURL(/\/inicio$/);

  for (const next of ["//evil.example", "/\\evil.example", "https://evil.example", "/auth/sign-out"]) {
    const response = await request.post("/auth/local-password", {
      form: { email: PRO, password, next },
      headers: { origin: new URL(page.url()).origin },
      maxRedirects: 0,
    });
    expect(response.status(), next).toBe(303);
    const location = new URL(response.headers().location, page.url());
    expect(location.origin, next).toBe(new URL(page.url()).origin);
    expect(location.pathname, next).toBe("/inicio");
  }
});

test("an ended session asks to sign in once and returns to the page", async ({ page, context }) => {
  await page.goto("/entrar?next=%2Finicio");
  await signIn(page, FREE);
  await skipSetupIfShown(page);
  const [cookie] = await sessionCookies(page);
  expect(cookie).toBeDefined();

  // A session whose access token has expired and whose refresh token the server no longer knows.
  const ended = { access_token: "x.y.z", refresh_token: "revoked", token_type: "bearer", expires_in: 3600, expires_at: 1, user: null };
  await context.clearCookies({ name: /^sb-/ });
  await context.addCookies([
    { name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(ended)).toString("base64url")}`, url: new URL(page.url()).origin, httpOnly: true, sameSite: "Lax" },
  ]);

  await page.goto("/lista");
  await expect(page).toHaveURL(/\/entrar\?next=%2Flista&motivo=sessao$/);
  await expect(page.getByRole("status").filter({ hasText: "Inicia sessão novamente" })).toBeVisible();
  expect(await sessionCookies(page)).toEqual([]);

  await page.goto("/carteira");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fcarteira$/);
});

test("a pending invite survives sign-in", async ({ page }) => {
  await page.goto("/convite/ABCDEFGH");
  await expect(page.getByText("ABCDEFGH")).toBeVisible();
  await page.goto("/entrar");
  await signIn(page, PRO);
  await skipSetupIfShown(page);
  expect(await page.evaluate(() => sessionStorage.getItem("investao.inviteCode"))).toBe("ABCDEFGH");
});
