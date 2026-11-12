import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

/**
 * Account deletion (path A) against the local stack: a throwaway account made for this run, deleted through
 * the account page. Its password is generated here and never leaves the local machine.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "";
test.skip(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) || !supabaseKey, "needs the local stack's URL and publishable key");

const auth = (path: string, body: object) =>
  fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: supabaseKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("a Google-style account is deleted with delete_user_account and cannot sign in again", async ({ page }) => {
  // A stack with sign-ups closed gets its throwaway account from the caller (THROWAWAY_EMAIL / _PASSWORD).
  let email = process.env.THROWAWAY_EMAIL ?? `deletion-${randomBytes(4).toString("hex")}@example.test`;
  let password = process.env.THROWAWAY_PASSWORD ?? randomBytes(18).toString("base64url");
  if (!process.env.THROWAWAY_EMAIL) {
    const created = await auth("signup", { email, password });
    test.skip(created.status === 403, "sign-ups are closed on this stack and no throwaway account was given");
    expect(created.status).toBe(200);
  }
  [email, password] = [email.trim(), password.trim()];
  const signedIn = await auth("token?grant_type=password", { email, password });
  expect(signedIn.status).toBe(200);
  const userID = ((await signedIn.json()) as { user: { id: string } }).user.id;

  await page.goto("/entrar?next=/definicoes/conta");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(password);
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  const name = page.getByTestId("setup-name");
  const heading = page.getByRole("heading", { level: 1, name: "Gerir conta" });
  await expect(name.or(heading)).toBeVisible();
  if (await name.isVisible()) {
    await page.getByRole("button", { name: "Agora não" }).click();
    await page.getByRole("button", { name: "Fazer isto mais tarde" }).click();
  }
  await expect(heading).toBeVisible();

  await page.getByTestId("delete-account").click();
  await expect(page.getByRole("dialog")).toContainText(email);
  await page.getByTestId("confirm-delete").click();
  await expect(page).toHaveURL(/\/entrar\?motivo=eliminada$/);
  await expect(page.getByTestId("account-deleted")).toBeVisible();
  expect((await page.context().cookies()).filter((cookie) => cookie.name.startsWith("sb-"))).toEqual([]);

  // The server no longer knows the account.
  const again = await auth("token?grant_type=password", { email, password });
  expect(again.status).toBe(400);
  test.info().annotations.push({ type: "deleted user", description: userID });
});
