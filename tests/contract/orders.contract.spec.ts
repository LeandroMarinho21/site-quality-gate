import { expect, test } from "@playwright/test";
import { expectSchema } from "../support/contract";
import { customers, product } from "../support/data";

test("POST /api/orders valido devolve 201 em order-created", async ({ request }) => {
  const trail = product("trail-32");
  const res = await request.post("/api/orders", {
    data: { customer: customers.mariana, items: [{ sku: trail.sku, qty: 2 }] },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expectSchema(body, "order-created");
  expect(body.order.total).toBe(trail.price * 2);
});

const rejections = [
  { name: "sacola vazia", data: { customer: customers.mariana, items: [] }, status: 400, error: "empty_cart" },
  { name: "sem cliente", data: { items: [{ sku: "trail-32", qty: 1 }] }, status: 400, error: "customer_required" },
  {
    name: "CEP invalido",
    data: { customer: { ...customers.mariana, cep: "123" }, items: [{ sku: "trail-32", qty: 1 }] },
    status: 400,
    error: "invalid_cep",
  },
  { name: "sku inexistente", data: { customer: customers.mariana, items: [{ sku: "ski-pro", qty: 1 }] }, status: 400, error: "unknown_sku" },
  { name: "quantidade zero", data: { customer: customers.mariana, items: [{ sku: "trail-32", qty: 0 }] }, status: 400, error: "invalid_qty" },
  {
    name: "acima do estoque",
    data: { customer: customers.mariana, items: [{ sku: "granite-boot", qty: product("granite-boot").stock + 1 }] },
    status: 409,
    error: "out_of_stock",
  },
];

for (const r of rejections) {
  test(`POST /api/orders recusa ${r.name} com ${r.status} ${r.error}`, async ({ request }) => {
    const res = await request.post("/api/orders", { data: r.data });
    expect(res.status()).toBe(r.status);
    const body = await res.json();
    expectSchema(body, "error");
    expect(body.error).toBe(r.error);
  });
}

test("JSON quebrado vira 400 bad_request", async ({ request }) => {
  const res = await request.post("/api/orders", {
    headers: { "content-type": "application/json" },
    data: "{nao e json",
  });
  expect(res.status()).toBe(400);
  expectSchema(await res.json(), "error");
});
