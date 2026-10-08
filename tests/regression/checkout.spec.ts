import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nimbus-cart"));
});

test("checkout da Mariana com a Trail 32L gera pedido", async ({ page }) => {
  await page.goto("/product.html?sku=trail-32");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/checkout.html");
  await page.getByTestId("checkout-name").fill("Mariana Alves");
  await page.getByTestId("checkout-email").fill("mariana.alves@example.com");
  await page.getByTestId("checkout-cep").fill("01310-100");
  await page.getByTestId("checkout-form").getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByTestId("checkout-result")).toContainText("Mariana Alves");
  await expect(page.getByTestId("checkout-result")).toContainText("R$ 289,00");
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});

test("checkout com sacola vazia mostra erro", async ({ page }) => {
  await page.goto("/checkout.html");
  await page.getByTestId("checkout-name").fill("João Ribeiro");
  await page.getByTestId("checkout-email").fill("joao.ribeiro@example.com");
  await page.getByTestId("checkout-cep").fill("22041-080");
  await page.getByTestId("checkout-form").getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByTestId("checkout-error")).toHaveText("A sacola está vazia.");
});

test("api recusa sku inexistente", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customer: { name: "Ana", email: "ana@example.com", cep: "01310-100" },
      items: [{ sku: "nao-existe", qty: 1 }],
    },
  });
  expect(res.status()).toBe(400);
});
