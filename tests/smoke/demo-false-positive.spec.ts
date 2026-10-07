import { expect, test } from "@playwright/test";

// Spec de demo: afirma um titulo que o site nao tem. Rode via workflow_dispatch
// (run_false_positive) para gravar o job vermelho; apague este arquivo depois.
test("titulo da proxima release @demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toHaveText("Release 2.0");
});
