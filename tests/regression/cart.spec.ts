import { expect, test } from "../support/fixtures";
import { brl, product } from "../support/data";

const trail = product("trail-32");
const apex = product("apex-light");

test("Trail 32L e Apex na sacola somam o total", async ({ page, shop }) => {
  await shop.addToBag(trail.sku);
  await shop.addToBag(apex.sku);
  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.getByTestId("nav-cart").click();
  await expect(page.getByTestId("cart-body")).toContainText(trail.name);
  await expect(page.getByTestId("cart-body")).toContainText(apex.name);
  await expect(page.getByTestId("cart-total")).toHaveText(brl(trail.price + apex.price));
});

test("mudar a quantidade recalcula total e contador", async ({ page, shop }) => {
  await shop.addToBag(apex.sku);
  await shop.setQty(apex.sku, 3);
  await expect(page.getByTestId("cart-total")).toHaveText(brl(apex.price * 3));
  await expect(page.getByTestId("cart-count")).toHaveText("3");
});

test("remover o unico item deixa a sacola vazia", async ({ page, shop }) => {
  await shop.addToBag("termo-1l");
  await page.goto("/cart.html");
  await page.getByTestId("remove-termo-1l").click();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("0");
});

test("sacola sobrevive a reload", async ({ page, shop }) => {
  await shop.addToBag(trail.sku);
  await page.goto("/cart.html");
  await page.reload();
  await expect(page.getByTestId("cart-body")).toContainText(trail.name);
});
