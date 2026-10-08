import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nimbus-cart"));
});

test("adiciona Trail 32L e Apex na sacola", async ({ page }) => {
  await page.goto("/product.html?sku=trail-32");
  await expect(page.getByTestId("product-name")).toHaveText("Mochila Trail 32L");
  await expect(page.getByTestId("product-price")).toContainText("289");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.goto("/product.html?sku=apex-light");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.getByTestId("nav-cart").click();
  await expect(page.getByTestId("cart-body")).toContainText("Mochila Trail 32L");
  await expect(page.getByTestId("cart-body")).toContainText("Lanterna Apex 800");
  await expect(page.getByTestId("cart-total")).toContainText("408");
});

test("remove item da sacola", async ({ page }) => {
  await page.goto("/product.html?sku=termo-1l");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/cart.html");
  await page.getByTestId("remove-termo-1l").click();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});
