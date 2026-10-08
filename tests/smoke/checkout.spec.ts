import { expect, test } from "@playwright/test";

test("api dispara run de smoke-home", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customer: {
        name: "Mariana Alves",
        email: "mariana.alves@example.com",
        cep: "canary",
      },
      items: [{ sku: "smoke-home", qty: 1 }],
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.ok).toBeTruthy();
  expect(body.order.total).toBe(45);
  expect(body.order.items[0].name).toBe("Smoke · home e health");
});

test("checkout legado GET continua saudavel", async ({ request }) => {
  const res = await request.get("/checkout");
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBeTruthy();
});
