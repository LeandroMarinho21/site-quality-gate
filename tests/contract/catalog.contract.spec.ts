import { expect, test } from "@playwright/test";
import { expectSchema } from "../support/contract";
import { catalog } from "../support/data";

test("GET /api/products segue product-list", async ({ request }) => {
  const res = await request.get("/api/products");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  const body = await res.json();
  expectSchema(body, "product-list");
  expect(body.products.map((p: { sku: string }) => p.sku)).toEqual(catalog.map((p) => p.sku));
});

test("GET /api/products/:sku segue product", async ({ request }) => {
  const res = await request.get("/api/products/apex-light");
  expect(res.status()).toBe(200);
  expectSchema(await res.json(), "product");
});

test("sku inexistente devolve 404 no formato de erro", async ({ request }) => {
  const res = await request.get("/api/products/ski-pro");
  expect(res.status()).toBe(404);
  const body = await res.json();
  expectSchema(body, "error");
  expect(body.error).toBe("sku_not_found");
});
