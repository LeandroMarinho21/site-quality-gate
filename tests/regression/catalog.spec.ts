import { expect, test } from "../support/fixtures";
import { brl, catalog, product } from "../support/data";

test("catalogo mostra todos os skus do cadastro", async ({ page }) => {
  await page.goto("/catalog.html");
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(catalog.length);
  await expect(page.getByTestId("product-granite-boot")).toContainText("Bota Granite Mid");
});

test("filtro de calcados mostra so a Granite", async ({ page }) => {
  await page.goto("/catalog.html");
  await page.getByTestId("filter-calcados").click();
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(
    catalog.filter((p) => p.category === "calcados").length,
  );
  await expect(page.getByTestId("product-granite-boot")).toBeVisible();
});

test("busca por lanterna pelo header acha a Apex 800", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search-input").fill("lanterna");
  await page.getByTestId("search-input").press("Enter");
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("product-apex-light")).toBeVisible();
  await expect(page.getByTestId("search-input")).toHaveValue("lanterna");
});

test("busca sem resultado mostra estado vazio", async ({ page }) => {
  await page.goto("/catalog.html?q=ski");
  await expect(page.getByTestId("catalog-empty")).toBeVisible();
  await expect(page.getByTestId("product-list").locator("li")).toHaveCount(0);
});

test("pagina do produto mostra preco e estoque do cadastro", async ({ page }) => {
  const boot = product("granite-boot");
  await page.goto(`/product.html?sku=${boot.sku}`);
  await expect(page.getByTestId("product-name")).toHaveText(boot.name);
  await expect(page.getByTestId("product-price")).toHaveText(brl(boot.price));
  await expect(page.getByTestId("product-stock")).toHaveText(String(boot.stock));
});

test("produto inexistente mostra aviso em vez de pagina quebrada", async ({ page }) => {
  await page.goto("/product.html?sku=ski-pro");
  await expect(page.getByTestId("product-missing")).toHaveText("Produto não encontrado.");
});

test("rota inexistente devolve 404 com link para o catalogo", async ({ page }) => {
  const res = await page.goto("/nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("not-found-title")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "catálogo" })).toHaveAttribute("href", "/catalog.html");
});
