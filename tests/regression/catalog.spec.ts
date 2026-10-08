import { expect, test } from "@playwright/test";

test("catalogo traz as seis suites", async ({ page }) => {
  await page.goto("/catalog.html");
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("product-analysis-job")).toContainText("Canary · analysis job");
});

test("filtro canary mostra error_rate e analysis", async ({ page }) => {
  await page.goto("/catalog.html");
  await page.getByTestId("filter-canary").click();
  await expect(page.getByTestId("product-canary-metrics")).toBeVisible();
  await expect(page.getByTestId("product-smoke-home")).toHaveCount(0);
});

test("busca por threshold acha a suite de metricas", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search-input").fill("threshold");
  await page.getByTestId("search-input").press("Enter");
  await expect(page.getByTestId("product-canary-metrics")).toBeVisible();
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
