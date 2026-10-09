import { expect, test } from "@playwright/test";

// Teste quebrado de proposito: o site esta em Release 1.0. So roda no drill
// false-positive do deploy, para mostrar o gate barrando um release saudavel
// e o resumo apontando "SLI verde, smoke vermelho".
test("titulo da proxima release @drill", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toHaveText("Release 2.0");
});
