import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Portuguese is the default locale; without this, locale detection sends the browser to /en.
test.use({ locale: "pt-AO" });

async function openGallery(page: Page, theme: "light" | "dark", path = "/dev/design") {
  const url = test.info().project.use.baseURL!;
  await page.context().addCookies([{ name: "theme", value: theme, url }]);
  await page.goto(path);
  await expect(page.getByTestId("format-check")).toBeVisible();
}

test("formatters match the table in this browser engine @engines", async ({ page }) => {
  await page.goto("/dev/design");
  const check = page.getByTestId("format-check");
  await expect(check).toBeVisible();
  expect(Number(await check.getAttribute("data-total"))).toBeGreaterThan(80);
  await expect(check).toHaveAttribute("data-failures", "0");
});

for (const theme of ["light", "dark"] as const) {
  test(`gallery has no console errors or serious axe issues (${theme})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await openGallery(page, theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(errors).toEqual([]);

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  });
}

test("tabs, radio groups and dialogs work from the keyboard", async ({ page }) => {
  await openGallery(page, "light", "/en/dev/design");

  const tabs = page.getByRole("region", { name: "Navigation" }).getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");

  const ranges = page.getByRole("radiogroup", { name: "Price performance" });
  await ranges.getByRole("radio", { name: "One month" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(ranges.getByRole("radio", { name: "Three months" })).toBeFocused();
  await expect(ranges.getByRole("radio", { name: "Three months" })).toHaveAttribute("aria-checked", "true");
  // "All history" is disabled in the gallery: End is ignored and arrows wrap past it.
  await page.keyboard.press("End");
  await expect(ranges.getByRole("radio", { name: "All history" })).toHaveAttribute("aria-checked", "false");

  const opener = page.getByRole("region", { name: "Overlays" }).getByRole("button", { name: "Dialog", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

// The component sections only: the full library is over 20 000 px tall on a phone. Foundations, overlays, feedback,
// landing and the formatter table are left out; tokens.test.ts and the tests above cover them.
const SCREENSHOT_SECTIONS = ["layout", "navigation", "buttons", "fields", "data"];

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`gallery screenshot ${theme} ${width}`, async ({ page }) => {
      test.skip(process.platform !== "darwin", "The baseline is recorded with macOS fonts.");
      await page.setViewportSize({ width, height: 900 });
      await openGallery(page, theme);
      await page.getByTestId("gallery-nav").evaluate((nav) => {
        nav.style.position = "static";
      });
      await page.locator("[data-gallery-section]").evaluateAll((sections, keep) => {
        for (const section of sections) if (!keep.includes(section.id)) section.style.display = "none";
      }, SCREENSHOT_SECTIONS);
      await expect(page).toHaveScreenshot(`gallery-${theme}-${width}.png`, { fullPage: true, animations: "disabled" });
    });
  }
}
