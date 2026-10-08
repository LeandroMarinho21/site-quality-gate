import { expect, test } from "@playwright/test";

test("catalogo traz os seis skus", async ({ page }) => {
  await page.goto("/catalog.html");
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("product-granite-boot")).toContainText("Bota Granite Mid");
});

test("filtro de calcados mostra so a Granite", async ({ page }) => {
  await page.goto("/catalog.html");
  await page.getByTestId("filter-calcados").click();
  await expect(page.getByTestId("product-granite-boot")).toBeVisible();
  await expect(page.getByTestId("product-trail-32")).toHaveCount(0);
});

test("busca por lanterna acha a Apex 800", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search-input").fill("lanterna");
  await page.getByTestId("search-input").press("Enter");
  await expect(page.getByTestId("product-apex-light")).toBeVisible();
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(1);
});

test("busca sem resultado mostra vazio", async ({ page }) => {
  await page.goto("/catalog.html?q=ski");
  await expect(page.getByTestId("catalog-empty")).toBeVisible();
});

test("pagina inexistente devolve 404", async ({ request }) => {
  const res = await request.get("/nao-existe");
  expect(res.status()).toBe(404);
});
