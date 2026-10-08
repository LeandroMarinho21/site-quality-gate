import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nimbus-queue"));
});

test("Mariana dispara smoke-home no canary", async ({ page }) => {
  await page.goto("/product.html?sku=smoke-home");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/checkout.html");
  await page.getByTestId("checkout-name").fill("Mariana Alves");
  await page.getByTestId("checkout-email").fill("mariana.alves@example.com");
  await page.getByTestId("checkout-cep").fill("canary");
  await page.getByTestId("checkout-form").getByRole("button", { name: "Confirmar run" }).click();
  await expect(page.getByTestId("checkout-result")).toContainText("Mariana Alves");
  await expect(page.getByTestId("checkout-result")).toContainText("45s");
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});

test("dispatch com fila vazia mostra erro", async ({ page }) => {
  await page.goto("/checkout.html");
  await page.getByTestId("checkout-name").fill("João Ribeiro");
  await page.getByTestId("checkout-email").fill("joao.ribeiro@example.com");
  await page.getByTestId("checkout-cep").fill("staging");
  await page.getByTestId("checkout-form").getByRole("button", { name: "Confirmar run" }).click();
  await expect(page.getByTestId("checkout-error")).toHaveText("A fila de execucao esta vazia.");
});

test("api recusa sku inexistente", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customer: { name: "Ana", email: "ana@example.com", cep: "canary" },
      items: [{ sku: "nao-existe", qty: 1 }],
    },
  });
  expect(res.status()).toBe(400);
});
