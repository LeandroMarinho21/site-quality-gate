import { expect, test } from "../support/fixtures";
import { customers } from "../support/data";

test("contato do Joao sobre a Granite Mid recebe confirmacao", async ({ page }) => {
  await page.goto("/contact.html");
  await page.getByTestId("contact-name").fill(customers.joao.name);
  await page.getByTestId("contact-message").fill("A Granite Mid serve no 42?");
  await page.getByTestId("contact-form").getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByTestId("contact-result")).toHaveText(`Recebemos a mensagem de ${customers.joao.name}.`);
});

test("formulario de contato nao envia vazio", async ({ page }) => {
  await page.goto("/contact.html");
  await page.getByTestId("contact-form").getByRole("button", { name: "Enviar" }).click();
  const missing = await page.getByTestId("contact-name").evaluate((el: HTMLInputElement) => el.validity.valueMissing);
  expect(missing).toBe(true);
  await expect(page.getByTestId("contact-result")).toBeHidden();
});
