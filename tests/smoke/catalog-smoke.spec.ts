import { expect, test } from "@playwright/test";

test("suites listam smoke-home e canary-metrics", async ({ page }) => {
  await page.goto("/catalog.html");
  await expect(page.getByTestId("product-smoke-home")).toBeVisible();
  await expect(page.getByTestId("product-canary-metrics")).toBeVisible();
});
