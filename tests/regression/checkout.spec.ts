import { expect, test } from "../support/fixtures";
import { brl, customers, product } from "../support/data";

test("checkout da Mariana com Trail e Apex fecha o pedido com o total certo", async ({ page, shop }) => {
  const trail = product("trail-32");
  const apex = product("apex-light");
  await shop.addToBag(trail.sku);
  await shop.addToBag(apex.sku);
  await shop.checkout(customers.mariana);
  const result = page.getByTestId("checkout-result");
  await expect(result).toContainText(customers.mariana.name);
  await expect(result).toContainText(brl(trail.price + apex.price));
  await expect(page.getByTestId("checkout-error")).toBeHidden();
});

test("checkout com sacola vazia avisa e nao confirma", async ({ page, shop }) => {
  await shop.checkout(customers.joao);
  await expect(page.getByTestId("checkout-error")).toHaveText("A sacola está vazia.");
  await expect(page.getByTestId("checkout-result")).toBeHidden();
});

test("CEP invalido explica o formato e mantem a sacola", async ({ page, shop }) => {
  await shop.addToBag("trail-32");
  await shop.checkout({ ...customers.mariana, cep: "0131" });
  await expect(page.getByTestId("checkout-error")).toHaveText("CEP inválido. Use 8 dígitos, como 01310-100.");
  await expect(page.getByTestId("cart-count")).toHaveText("1");
});

test("quantidade acima do estoque mostra quanto resta", async ({ page, shop }) => {
  const boot = product("granite-boot");
  await shop.addToBag(boot.sku);
  await shop.setQty(boot.sku, boot.stock + 1);
  await shop.checkout(customers.joao);
  await expect(page.getByTestId("checkout-error")).toHaveText(
    `Estoque insuficiente para ${boot.name}: restam ${boot.stock}.`,
  );
});
