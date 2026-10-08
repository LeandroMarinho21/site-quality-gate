import { expect, test } from "@playwright/test";

test("Joao reporta flake no smoke-home", async ({ page }) => {
  await page.goto("/contact.html");
  await page.getByTestId("contact-name").fill("João Ribeiro");
  await page.getByTestId("contact-message").fill("Smoke · home e health flakando no pause de 10%.");
  await page.getByTestId("contact-form").getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByTestId("contact-result")).toHaveText("Flake registrado por João Ribeiro.");
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
