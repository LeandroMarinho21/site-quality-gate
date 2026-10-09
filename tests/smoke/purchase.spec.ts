import { expect, test } from "../support/fixtures";
import { brl, customers, product } from "../support/data";

test("compra ponta a ponta: produto, sacola e pedido confirmado", async ({ page, shop }) => {
  const trail = product("trail-32");
  await shop.addToBag(trail.sku);
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await shop.checkout(customers.mariana);

  const result = page.getByTestId("checkout-result");
  await expect(result).toContainText(/Pedido NB-\d{4,} confirmado/);
  await expect(result).toContainText(brl(trail.price));
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});
