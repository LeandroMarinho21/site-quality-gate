import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nimbus-queue"));
});

test("enfileira smoke-home e smoke-health", async ({ page }) => {
  await page.goto("/product.html?sku=smoke-home");
  await expect(page.getByTestId("product-name")).toHaveText("Smoke · home e health");
  await expect(page.getByTestId("product-price")).toContainText("45s");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.goto("/product.html?sku=smoke-health");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.getByTestId("nav-cart").click();
  await expect(page.getByTestId("cart-body")).toContainText("Smoke · home e health");
  await expect(page.getByTestId("cart-body")).toContainText("Smoke · checkout API");
  await expect(page.getByTestId("cart-total")).toHaveText("65s");
});

test("remove suite da fila", async ({ page }) => {
  await page.goto("/product.html?sku=analysis-job");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/cart.html");
  await page.getByTestId("remove-analysis-job").click();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});
