import { expect, test } from "@playwright/test";

test("checkout saudavel retorna 200", async ({ request }) => {
  const res = await request.get("/checkout");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBeTruthy();
});
