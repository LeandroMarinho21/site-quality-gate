import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../support/fixtures";

const pages = [
  ["home", "/"],
  ["catalogo", "/catalog.html"],
  ["produto", "/product.html?sku=trail-32"],
  ["sacola", "/cart.html"],
  ["checkout", "/checkout.html"],
  ["contato", "/contact.html"],
];

for (const [name, url] of pages) {
  test(`${name} sem violacao serious ou critical do axe`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const blocking = violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(blocking).toEqual([]);
  });
}
