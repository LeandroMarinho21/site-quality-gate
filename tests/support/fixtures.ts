import { test as base, expect, type Page } from "@playwright/test";
import { customers } from "./data";

type Customer = (typeof customers)[keyof typeof customers];

export class Shop {
  constructor(private readonly page: Page) {}

  async addToBag(sku: string) {
    await this.page.goto(`/product.html?sku=${sku}`);
    await this.page.getByTestId("add-to-cart").click();
    await expect(this.page.getByTestId("added-flash")).toBeVisible();
  }

  async setQty(sku: string, qty: number) {
    await this.page.goto("/cart.html");
    const input = this.page.getByTestId(`qty-${sku}`);
    await input.fill(String(qty));
    await input.press("Tab");
  }

  async checkout(customer: Customer) {
    await this.page.goto("/checkout.html");
    await this.page.getByTestId("checkout-name").fill(customer.name);
    await this.page.getByTestId("checkout-email").fill(customer.email);
    await this.page.getByTestId("checkout-cep").fill(customer.cep);
    await this.page.getByTestId("checkout-form").getByRole("button", { name: "Confirmar pedido" }).click();
  }
}

export const test = base.extend<{ shop: Shop; failOnPageError: void }>({
  shop: async ({ page }, use) => {
    await use(new Shop(page));
  },
  failOnPageError: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await use();
      expect(errors, "exceções JavaScript na página").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
