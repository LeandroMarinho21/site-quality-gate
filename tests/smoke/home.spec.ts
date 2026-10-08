import { expect, test } from "@playwright/test";

test("console mostra o gate Release 1.0", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("brand")).toHaveText("Nimbus Gate");
  await expect(page.getByTestId("home-title")).toContainText("Release 1.0");
  await expect(page.getByTestId("featured")).toContainText("Smoke · home e health");
});

test("health responde ok", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("status expoe metricas", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByTestId("metrics-panel")).toBeVisible();
  await expect(page.getByTestId("metric-error-rate")).toBeVisible();
});
