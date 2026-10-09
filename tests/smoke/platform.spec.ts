import { expect, test } from "../support/fixtures";

test("health responde ok na versao que esta sendo promovida", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  // Sem isso o smoke pode passar batendo no stable e aprovar um canary que nunca viu.
  if (process.env.EXPECTED_VERSION) {
    expect(body.version).toBe(process.env.EXPECTED_VERSION);
  }
});

test("checkout legado GET continua respondendo", async ({ request }) => {
  const res = await request.get("/checkout");
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});
