import { expect, test } from "@playwright/test";

test("catalogo lista a Trail 32L e a Apex 800", async ({ page }) => {
  await page.goto("/catalog.html");
  await expect(page.getByTestId("product-trail-32")).toBeVisible();
  await expect(page.getByTestId("product-apex-light")).toBeVisible();
});
