import { expect, test } from "../support/fixtures";

test("hero da home leva ao catalogo", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hero-catalog").click();
  await expect(page.getByTestId("catalog-title")).toHaveText("Catálogo");
});

test("header leva a contato e sobre e marca a pagina atual", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-contact").click();
  await expect(page.getByTestId("contact-title")).toBeVisible();
  await expect(page.getByTestId("nav-contact")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("nav-about").click();
  await expect(page.getByTestId("about-copy")).toContainText("Trail 32L");
});

test("painel de status mostra a mesma versao do health", async ({ page, request }) => {
  const { version } = await (await request.get("/health")).json();
  await page.goto("/");
  await page.getByTestId("nav-status").click();
  await expect(page.getByTestId("metrics-panel")).toBeVisible();
  await expect(page.getByTestId("metric-version")).toHaveText(version);
});
