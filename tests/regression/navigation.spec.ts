import { expect, test } from "@playwright/test";

test("console abre as suites pelo hero", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hero-catalog").click();
  await expect(page.getByTestId("catalog-title")).toHaveText("Suites");
});

test("header leva a flake e sobre", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-contact").click();
  await expect(page.getByTestId("contact-title")).toBeVisible();
  await page.getByTestId("nav-about").click();
  await expect(page.getByTestId("about-copy")).toContainText("smoke-home");
});

test("status permanece no header", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-status").click();
  await expect(page.getByTestId("metrics-panel")).toBeVisible();
});
