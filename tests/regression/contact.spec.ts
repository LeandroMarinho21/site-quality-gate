import { expect, test } from "@playwright/test";

test("contato do Joao sobre a Granite Mid", async ({ page }) => {
  await page.goto("/contact.html");
  await page.getByTestId("contact-name").fill("João Ribeiro");
  await page.getByTestId("contact-message").fill("A Granite Mid serve no 42?");
  await page.getByTestId("contact-form").getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByTestId("contact-result")).toHaveText("Recebemos a mensagem de João Ribeiro.");
});

test("api de contato exige nome e mensagem", async ({ request }) => {
  const res = await request.post("/api/contact", { data: { name: "" } });
  expect(res.status()).toBe(400);
});

test("metrics expoe contadores prometheus", async ({ request }) => {
  const res = await request.get("/metrics");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("http_requests_total");
  expect(text).toContain("http_error_rate");
});
