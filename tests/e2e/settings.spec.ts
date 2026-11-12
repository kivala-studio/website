import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, test } from "@playwright/test";

/*
 * W10 in demo mode: privacy mode, the settings rows, and account deletion through the non-Apple path (demo
 * accounts sign in with Google). The Apple path's receipt checks are unit tests; here only its guards run.
 */
test.use({ locale: "pt-AO" });

async function signIn(context: BrowserContext, tier: "free" | "plus") {
  await context.addCookies(
    [
      ["demo-account", tier],
      ["demo-scenario", "open"],
    ].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })),
  );
}

const cookieNames = async (context: BrowserContext) => (await context.cookies()).map((cookie) => cookie.name);

test("privacy mode hides personal content, explains itself once and stays after reload and sign-out", async ({ page, context }) => {
  await signIn(context, "plus");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atividade");
  const personal = page.getByTestId("activity-row").filter({ hasText: "carteira ganhou terreno" });
  await expect(personal).toHaveCount(1);

  await page.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(page.getByRole("dialog", { name: "Valores ocultos" })).toBeVisible();
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modo de privacidade ativado" })).toHaveCount(1);
  await expect(page.getByText("carteira ganhou terreno")).toHaveCount(0);
  await expect(page.getByText("Conteúdo pessoal oculto no Modo de privacidade.").first()).toBeVisible();
  // Public rows stay readable.
  await expect(page.getByTestId("activity-row").filter({ hasText: "está a mexer" })).toHaveCount(1);

  // Rendered hidden by the server: no value flashes on load.
  const html = await (await page.request.get("/atividade")).text();
  expect(html).not.toContain("carteira ganhou terreno");
  await page.reload();
  await expect(page.getByRole("button", { name: "Mostrar valores" })).toBeVisible();

  // Alert thresholds are personal too; screen readers hear "Valor oculto".
  await page.goto("/lista");
  await expect(page.getByTestId("watchlist-count")).toBeVisible();
  // The third row has no alert yet in the Plus demo.
  await page.getByTestId("watchlist-row").nth(2).getByRole("button", { name: /^Criar alerta para / }).click();
  const panel = page.getByTestId("alerts-panel");
  await panel.getByTestId("new-alert").click();
  await page.getByTestId("alert-kind").selectOption("volume_above_average");
  await page.getByTestId("save-alert").click();
  await expect(panel.getByTestId("alert-rule")).toContainText("Volume acima da média");
  await expect(panel.getByTestId("alert-rule")).not.toContainText("2×");
  await expect(panel.getByTestId("alert-rule").getByText("Valor oculto")).toHaveCount(1);
  // Turning it back on later does not explain again.
  await panel.getByRole("button", { name: "Mostrar valores" }).click();
  await expect(panel.getByTestId("alert-rule")).toContainText("2×");
  await panel.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(page.getByRole("dialog", { name: "Valores ocultos" })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await page.goto("/definicoes");
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect(await cookieNames(context)).toContain("investao-privacy");
});

test("settings lists the account, appearance, app and market data rows", async ({ page, context }) => {
  await signIn(context, "plus");
  await page.goto("/definicoes");
  await expect(page.getByTestId("identity")).toContainText("plus@example.test");
  for (const name of ["Conta", "Notificações", "Aparência", "Aplicação", "Dados de mercado"]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Termos" })).toHaveAttribute("href", "/termos");
  await expect(page.getByRole("link", { name: "Política de privacidade" })).toHaveAttribute("href", "/policy");
  await page.getByText("Sobre a invest.ao").click();
  await expect(page.getByText(/reúne cotações, notícias e alertas/)).toBeVisible();

  await page.getByRole("radio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/definicoes$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile");
});

test("deletes the account: confirmation, then signed out with nothing of it left in the browser", async ({ page, context }) => {
  // Signed out, the public deletion page leads to sign-in and on to the deletion screen.
  await page.goto("/eliminar-conta");
  await expect(page.getByRole("main").getByRole("link", { name: "Iniciar sessão" })).toHaveAttribute("href", "/entrar?next=/definicoes/conta");

  await signIn(context, "plus");
  await context.addCookies([{ name: "theme", value: "dark", domain: "localhost", path: "/" }]);
  await page.goto("/definicoes/conta");
  await expect(page.getByRole("heading", { level: 2, name: "Eliminar conta" })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("investao.account.watchlist", "x");
    sessionStorage.setItem("investao.account.draft", "x");
  });

  // Cancelling makes no request.
  await page.getByTestId("delete-account").click();
  const dialog = page.getByRole("dialog", { name: "Eliminar conta na invest.ao?" });
  await expect(dialog).toContainText("plus@example.test");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByTestId("delete-account").click();
  // The browser applies `Clear-Site-Data` itself (the header is checked in the unit test); its effect is checked below.
  await page.getByTestId("confirm-delete").click();
  await expect(page).toHaveURL(/\/entrar\?motivo=eliminada$/);
  await expect(page.getByTestId("account-deleted")).toContainText("Conta eliminada");

  // Every account cookie and storage entry is gone; device preferences stay.
  const left = await cookieNames(context);
  // `demo-scenario` is the demo market's scenario, not account data.
  expect(left.filter((name) => (name.startsWith("demo-") && name !== "demo-scenario") || name.startsWith("sb-") || name === "investao-apple-deletion")).toEqual([]);
  expect(left).toContain("theme");
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.goto("/definicoes");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fdefinicoes$/);
});

test("deletion endpoints accept only same-origin posts, and a receipt without its attempt does nothing", async ({ page, context, request }) => {
  expect((await request.get("/api/account/apple-deletion/start", { maxRedirects: 0 })).status()).toBe(405);
  for (const path of ["/api/account/apple-deletion/start", "/api/account/delete"]) {
    const response = await request.post(path, { headers: { origin: "https://evil.example" }, form: { account: "d5e00000-0000-4000-8000-000000000002" }, maxRedirects: 0 });
    expect(response.status(), path).toBe(403);
  }

  await signIn(context, "plus");
  await page.goto("/api/account/apple-deletion/complete?receipt=abc.def");
  await expect(page).toHaveURL(/\/definicoes\/conta\?eliminacao=falhou$/);
  await expect(page.getByTestId("deletion-result")).toContainText("Não foi possível eliminar a conta");
  expect(await cookieNames(context)).toContain("demo-account");
});

test("/definicoes and /definicoes/conta have no serious axe issues, light and dark, phone and desktop", async ({ page, context }) => {
  await signIn(context, "plus");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const path of ["/definicoes", "/definicoes/conta"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id), `${path} ${scheme} ${width}`).toEqual([]);
      }
    }
  }
});

