import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, expect, test } from "@playwright/test";

/*
 * W9 in demo mode: server-shaped notifications relative to the request time (more than one keyset page), one
 * explicit alert delivered to two devices, read receipts and preferences in the demo account's cookies.
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

const rows = (page: Page) => page.getByTestId("activity-row");
const bell = (page: Page) => page.getByRole("link", { name: /^Atividade, / });

async function openActivity(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atividade");
  await expect(rows(page).first()).toBeVisible();
}

test("the inbox pages by keyset, opens rows as read and clears the bell", async ({ page, context }) => {
  await signIn(context, "plus");
  await openActivity(page);
  await expect(bell(page)).toHaveAccessibleName("Atividade, Há atividade nova");

  // One row per alert event, whatever the number of devices; the threshold never shows.
  await expect(rows(page).filter({ hasText: "O seu alerta de preço foi atingido" })).toHaveCount(1);
  await expect(page.getByText("100 000")).toHaveCount(0);

  // Older rows come from the next keyset page (created_at and id), never an offset.
  const before = await rows(page).count();
  const request = page.waitForRequest((sent) => sent.url().includes("/api/account/activity?"));
  await page.getByTestId("load-more").click();
  const url = new URL((await request).url());
  expect([...url.searchParams.keys()].sort()).toEqual(["before_created_at", "before_id"]);
  await expect.poll(() => rows(page).count()).toBeGreaterThan(before);

  // Opening a row marks it read and goes to its instrument.
  const movement = rows(page).filter({ hasText: "está a mexer" });
  await movement.getByRole("link").click();
  await expect(page).toHaveURL(/\/mercado\//);
  await page.goBack();
  await expect(rows(page).filter({ hasText: "está a mexer" })).toHaveAttribute("data-read", "true");

  // "Ler todas" marks only the current filter: the bell clears once both are read.
  await page.getByTestId("mark-all-read").click();
  await expect(bell(page)).toHaveAccessibleName("Atividade, Há atividade nova");
  await page.getByRole("tab", { name: "Notícias" }).click();
  await expect(rows(page).filter({ hasText: "Fecho da BODIVA" })).toHaveCount(1);
  await page.getByTestId("mark-all-read").click();
  await expect(bell(page)).toHaveAccessibleName("Atividade, Sem atividade nova");
  await expect(page.getByTestId("mark-all-read")).toBeDisabled();

  await page.reload();
  await expect(rows(page).first()).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName("Atividade, Sem atividade nova");
  await expect(rows(page).and(page.locator('[data-read="false"]'))).toHaveCount(0);
});

test("notification preferences are saved and survive a reload", async ({ page, context }) => {
  await signIn(context, "free");
  await page.goto("/definicoes");
  const dailyClose = page.getByTestId("preference-daily_close_enabled");
  await expect(dailyClose).toHaveAttribute("aria-checked", "false");
  await dailyClose.click();
  await page.getByTestId("preference-recaps").click();
  await page.getByTestId("preference-rule-large_trade").click();
  await page.getByTestId("preference-unusual").click();
  await expect(page.getByTestId("preference-rule-volume_spike")).toBeDisabled();
  // Saves run in order, one section at a time; wait until the account holds all four changes.
  await expect
    .poll(async () => {
      const cookie = (await context.cookies()).find((entry) => entry.name === "demo-notification-preferences");
      if (!cookie) return null;
      const saved = JSON.parse(decodeURIComponent(cookie.value));
      return [saved.categories.daily_close_enabled, saved.recaps, saved.unusual.enabled, saved.unusual.disabledRules.includes("large_trade")];
    })
    .toEqual([true, true, false, true]);

  await page.reload();
  await expect(page.getByTestId("preference-daily_close_enabled")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("preference-recaps")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("preference-unusual")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("preference-rule-large_trade")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("preference-rule-volume_spike")).toHaveAttribute("aria-checked", "true");
});

test("/atividade and /definicoes have no serious axe issues, light and dark, phone and desktop", async ({ page, context }, testInfo) => {
  await signIn(context, "plus");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const path of ["/atividade", "/definicoes"]) {
        await page.goto(path);
        await expect(path === "/atividade" ? rows(page).first() : page.getByTestId("notification-settings")).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([]);
        await testInfo.attach(`${path.slice(1)}-${scheme}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      }
    }
  }
});
