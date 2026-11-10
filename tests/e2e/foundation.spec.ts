import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home sends the security headers with a fresh CSP nonce", async ({ request }) => {
  const first = await request.get("/");
  const second = await request.get("/");
  const headers = first.headers();

  expect(first.status()).toBe(200);
  expect(headers["strict-transport-security"]).toBe("max-age=63072000");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();

  const csp = headers["content-security-policy"];
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).not.toContain("unsafe-eval");
  expect(second.headers()["content-security-policy"]).not.toContain(nonce);

  const scripts = [...(await first.text()).matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag);
  expect(scripts.length).toBeGreaterThan(0);
  for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
});

test("home renders with the app icon, no CSP violations and no serious axe issues", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) violations.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("invest.ao");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  expect(violations).toEqual([]);

  const { violations: axe } = await new AxeBuilder({ page }).analyze();
  expect(axe.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});
