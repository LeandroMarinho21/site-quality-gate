import { expect, test } from "../support/fixtures";

test("home carrega com destaques que levam a produtos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("brand")).toBeVisible();
  const links = page.getByTestId("featured").locator('a[href^="/product.html?sku="]');
  await expect(links.first()).toBeVisible();
  expect(await links.count()).toBeGreaterThan(0);
});

test("catalogo renderiza tudo o que a API devolve", async ({ page, request }) => {
  const { products } = await (await request.get("/api/products")).json();
  await page.goto("/catalog.html");
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(products.length);
});
