import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Demo mode has no accounts: sign-in is shown as unavailable and every signed-in page asks for it.
test.use({ locale: "pt-AO" });

const SIGNED_IN = ["/inicio", "/carteira", "/lista", "/pesquisa", "/atividade", "/atividade-invulgar", "/definicoes"];

test("signed-in pages send visitors to /entrar with the way back, never cached", async ({ request }) => {
  for (const path of [...SIGNED_IN, "/carteira?livro=principal", "/en/lista"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    const english = path.startsWith("/en/");
    const location = new URL(response.headers().location, "http://localhost");
    expect(location.pathname, path).toBe(english ? "/en/entrar" : "/entrar");
    // The default destination is left out of the URL.
    expect(location.searchParams.get("next"), path).toBe(path === "/inicio" ? null : path);
    expect(response.headers()["cache-control"], path).toBe("private, no-store");
  }
});

test("/entrar shows both providers as unavailable, no password form and no serious axe issues", async ({ page }) => {
  await page.goto("/carteira");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fcarteira$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Iniciar sessão");
  await expect(page.getByText("Não liga a tua conta bancária ou de corretagem.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continuar com Apple" })).toBeDisabled();
  await expect(page.getByText("O início de sessão não está disponível nesta versão do site.")).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([]);

  await page.goto("/en/entrar?motivo=sessao");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.getByRole("status").filter({ hasText: "Sign in again" })).toBeVisible();
});

test("auth endpoints do nothing without accounts and refuse cross-site sign-out", async ({ request }) => {
  for (const path of ["/auth/sign-in?provider=google&next=%2Fcarteira", "/auth/callback?code=x"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(303);
    expect(new URL(response.headers().location).pathname, path).toBe("/entrar");
  }
  const crossSite = await request.post("/auth/sign-out", { headers: { origin: "https://evil.example" }, maxRedirects: 0 });
  expect(crossSite.status()).toBe(403);
  expect((await request.post("/auth/local-password", { maxRedirects: 0 })).status()).toBe(404);
});
