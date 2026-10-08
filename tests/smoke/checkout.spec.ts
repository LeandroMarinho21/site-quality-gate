import { expect, test } from "@playwright/test";

test("api de checkout aceita pedido da Trail 32L", async ({ request }) => {
  const res = await request.post("/api/orders", {
    data: {
      customer: {
        name: "Mariana Alves",
        email: "mariana.alves@example.com",
        cep: "01310-100",
      },
      items: [{ sku: "trail-32", qty: 1 }],
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.ok).toBeTruthy();
  expect(body.order.total).toBe(289);
  expect(body.order.items[0].name).toBe("Mochila Trail 32L");
});

test("checkout legado GET continua saudavel", async ({ request }) => {
  const res = await request.get("/checkout");
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBeTruthy();
});
