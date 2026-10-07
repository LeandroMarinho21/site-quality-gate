import { expect, test } from "@playwright/test";

test("navega da home para o catalogo", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-catalog").click();
  await expect(page.getByTestId("catalog-title")).toHaveText("Catálogo");
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(3);
});

test("navega para contato", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-contact").click();
  await expect(page.getByTestId("contact-title")).toBeVisible();
});

test("link de status esta no header", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-status").click();
  await expect(page.getByTestId("metrics-panel")).toBeVisible();
});
