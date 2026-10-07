import { expect, test } from "@playwright/test";

test("home carrega com o titulo da release atual", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("brand")).toHaveText("Nimbus Shop");
  await expect(page.getByTestId("home-title")).toContainText("Release 1.0");
});

test("health responde ok", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
});

test("status expoe metricas", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByTestId("metrics-panel")).toBeVisible();
  await expect(page.getByTestId("metric-error-rate")).toBeVisible();
});
