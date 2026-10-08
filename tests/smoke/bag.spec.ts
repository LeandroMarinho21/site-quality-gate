import { expect, test } from "@playwright/test";

test("smoke adiciona Trail 32L na sacola", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nimbus-cart"));
  await page.goto("/product.html?sku=trail-32");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await expect(page.getByTestId("added-flash")).toBeVisible();
});
