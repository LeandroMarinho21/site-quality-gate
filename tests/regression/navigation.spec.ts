import { expect, test } from "@playwright/test";

test("home abre o catalogo pelo hero", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hero-catalog").click();
  await expect(page.getByTestId("catalog-title")).toHaveText("Catálogo");
});

test("header leva a contato e sobre", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-contact").click();
  await expect(page.getByTestId("contact-title")).toBeVisible();
  await page.getByTestId("nav-about").click();
  await expect(page.getByTestId("about-copy")).toContainText("Trail 32L");
});

test("status permanece no header", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-status").click();
  await expect(page.getByTestId("metrics-panel")).toBeVisible();
});
