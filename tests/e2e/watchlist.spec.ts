import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect, test } from "@playwright/test";

/*
 * W8 in demo mode: the watchlist and alert rules live in the demo account's cookies, and every write applies
 * the backend's limits. The default list holds four priced equities (one past the Free limit).
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

const rows = (page: Page) => page.getByTestId("watchlist-row");
const order = (page: Page) => page.locator("[data-security]").evaluateAll((links) => links.map((link) => link.getAttribute("data-security")));
const upgradeReason = (page: Page) => page.getByTestId("upgrade-reason");

async function openList(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lista");
  await expect(page.getByTestId("watchlist-count")).toBeVisible();
}

test("add, reorder by keyboard, remove and undo; every change is saved", async ({ page, context }) => {
  await signIn(context, "plus");
  await openList(page);
  await expect(rows(page)).toHaveCount(4);
  const initial = await order(page);

  // Keyboard only: the second row's menu → "Mover para cima".
  await rows(page).nth(1).getByTestId("row-menu").focus();
  await page.keyboard.press("Enter");
  const moveUp = page.getByRole("menuitem", { name: "Mover para cima" });
  for (let step = 0; step < 6 && !(await moveUp.evaluate((item) => item === document.activeElement)); step += 1) await page.keyboard.press("ArrowDown");
  await expect(moveUp).toBeFocused();
  await page.keyboard.press("Enter");
  const swapped = [initial[1], initial[0], ...initial.slice(2)];
  await expect.poll(() => order(page)).toEqual(swapped);
  // Focus stays on the moved row, so it can move again.
  await expect(rows(page).nth(0).getByTestId("row-menu")).toBeFocused();

  // Remove with undo: the bar stays until undone; the row returns to its place.
  await rows(page).nth(2).getByTestId("row-menu").click();
  await page.getByRole("menuitem", { name: "Remover" }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByTestId("undo-bar")).toContainText("removido.");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByTestId("undo-bar")).toBeHidden();
  await expect.poll(() => order(page)).toEqual(swapped);

  // Add from the dialog: the instrument joins the end of the list.
  await page.getByTestId("add-instruments").click();
  const dialog = page.getByTestId("add-dialog");
  await dialog.getByRole("searchbox").fill("SBAO");
  await dialog.getByTestId("add-candidate").first().click();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(rows(page)).toHaveCount(5);

  await page.reload();
  await expect(rows(page)).toHaveCount(5);
  expect((await order(page)).slice(0, 4)).toEqual(swapped);
});

test("Plus groups filter the list; Free sees each limit's reason", async ({ page, context }) => {
  await signIn(context, "plus");
  await openList(page);
  await page.getByTestId("groups-menu").click();
  await page.getByRole("menuitem", { name: "Novo grupo" }).click();
  await page.getByTestId("group-name").fill("  Bancos  ");
  await page.getByTestId("save-group").click();
  await expect(page.getByRole("tab", { name: "Bancos" })).toHaveAttribute("aria-selected", "true");
  await expect(rows(page)).toHaveCount(0);

  await page.getByRole("tab", { name: "Todos" }).click();
  await rows(page).first().getByTestId("row-menu").click();
  await page.getByRole("menuitemcheckbox", { name: "Bancos" }).click();
  await page.getByRole("tab", { name: "Bancos" }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Bancos" })).toHaveAttribute("aria-selected", "true");
  await expect(rows(page)).toHaveCount(1);

  await context.clearCookies();
  await signIn(context, "free");
  await openList(page);
  // Four saved, three active: the fourth is paused and the plan line offers the choice.
  await expect(page.getByTestId("paused-badge")).toHaveCount(1);
  await expect(page.getByTestId("free-plan-line")).toContainText("3/3 ativos · 1 pausados");
  await page.getByTestId("groups-menu").click();
  await page.getByRole("menuitem", { name: "Novo grupo" }).click();
  await expect(upgradeReason(page)).toHaveText("Organize a sua lista em grupos com o Plus.");
  await page.getByRole("button", { name: "OK", exact: true }).click();

  await page.getByTestId("add-instruments").click();
  await page.getByTestId("add-candidate").first().click();
  await expect(upgradeReason(page)).toHaveText("O plano gratuito inclui 3 instrumentos guardados.");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(rows(page)).toHaveCount(4);

  // The Free selection: the last instrument becomes active instead of the first.
  const before = await order(page);
  await page.getByTestId("free-plan-line").click();
  const selection = page.getByTestId("free-selection");
  await selection.getByRole("checkbox").first().click();
  await selection.getByRole("checkbox").nth(3).click();
  await page.getByTestId("save-free-selection").click();
  await expect(page.getByText("Escolha guardada.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(`[data-security="${before[0]}"]`).getByTestId("paused-badge")).toBeVisible();
  await expect(page.locator(`[data-security="${before[3]}"]`).getByTestId("paused-badge")).toHaveCount(0);
});

test("alerts: create, pause, edit and delete a rule; Free stops at two", async ({ page, context }) => {
  await signIn(context, "plus");
  await openList(page);
  await rows(page).nth(2).getByRole("button", { name: /^Criar alerta para / }).click();
  const panel = page.getByTestId("alerts-panel");
  await expect(panel.getByTestId("alerts-delivery-note")).toBeVisible();
  await panel.getByRole("button", { name: "Fechar aviso" }).click();
  await expect(panel.getByTestId("alerts-delivery-note")).toBeHidden();

  await panel.getByTestId("new-alert").click();
  const editor = page.getByTestId("alert-editor");
  await editor.getByTestId("alert-kind").selectOption("volume_above_average");
  await expect(editor.getByTestId("alert-value")).toHaveValue("2,00");
  await editor.getByTestId("alert-value").fill("25");
  await expect(editor.getByTestId("save-alert")).toBeDisabled();
  await editor.getByTestId("alert-value").fill("3");
  await editor.getByTestId("save-alert").click();
  const rule = panel.getByTestId("alert-rule");
  await expect(rule).toHaveCount(1);
  await expect(rule).toContainText("Volume acima da média 3×");

  await rule.getByRole("switch").click();
  await expect(rule.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await expect(rule).toContainText("Em pausa");

  await rule.getByRole("button", { name: /^Editar alerta/ }).click();
  await editor.getByTestId("alert-kind").selectOption("days_without_trades");
  await editor.getByTestId("save-alert").click();
  await expect(rule).toContainText("Dias sem negócios 7 dias");

  await page.reload();
  await rows(page).nth(2).getByRole("button", { name: /alerta/ }).click();
  await expect(panel.getByTestId("alert-rule")).toContainText("Dias sem negócios 7 dias");
  await expect(panel.getByTestId("alerts-delivery-note")).toBeHidden();
  await panel.getByTestId("alert-rule").getByRole("button", { name: /^Apagar/ }).click();
  await expect(panel.getByTestId("alert-rule")).toHaveCount(0);
  await page.reload();
  await rows(page).nth(2).getByRole("button", { name: /alerta/ }).click();
  await expect(panel.getByText("Ainda não tens alertas")).toBeVisible();

  await context.clearCookies();
  await signIn(context, "free");
  await openList(page);
  await rows(page).first().getByRole("button", { name: /^Criar alerta para / }).click();
  for (const kind of ["high_52w", "low_52w", "high_52w"]) {
    await panel.getByTestId("new-alert").click();
    await editor.getByTestId("alert-kind").selectOption(kind);
    await editor.getByTestId("save-alert").click();
  }
  await expect(upgradeReason(page)).toHaveText("Crie mais de 2 alertas com o Plus.");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(panel.getByTestId("alert-rule")).toHaveCount(2);
});

test("/lista has no serious axe issues, light and dark, phone and desktop", async ({ page, context }, testInfo) => {
  await signIn(context, "plus");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/lista");
      await expect(rows(page)).toHaveCount(4);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([]);
      await testInfo.attach(`lista-${scheme}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }
  }
});
