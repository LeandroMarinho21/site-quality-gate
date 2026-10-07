import { expect, test } from "@playwright/test";

test("formulario de contato confirma envio", async ({ page }) => {
  await page.goto("/contact.html");
  await page.getByTestId("contact-name").fill("Leandro");
  await page.getByTestId("contact-message").fill("Pedido de teste");
  await page.getByTestId("contact-form").getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByTestId("contact-result")).toHaveText("Recebemos seu pedido.");
});

test("home mostra produtos em destaque", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("featured")).toContainText("Mochila Trail 32L");
  await expect(page.getByTestId("featured")).toContainText("Lanterna Apex");
});

test("metrics expõe contadores prometheus", async ({ request }) => {
  const res = await request.get("/metrics");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("http_requests_total");
  expect(text).toContain("http_error_rate");
});
