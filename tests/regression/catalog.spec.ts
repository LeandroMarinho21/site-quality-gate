import { expect, test } from "@playwright/test";

test("catalogo lista skus conhecidos", async ({ page }) => {
  await page.goto("/catalog.html");
  await expect(page.locator('[data-sku="trail-32"]')).toBeVisible();
  await expect(page.locator('[data-sku="apex-light"]')).toBeVisible();
  await expect(page.locator('[data-sku="rain-shell"]')).toBeVisible();
});

test("pagina inexistente devolve 404", async ({ request }) => {
  const res = await request.get("/nao-existe");
  expect(res.status()).toBe(404);
});
