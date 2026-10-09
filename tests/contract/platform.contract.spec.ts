import { expect, test } from "@playwright/test";
import { expectSchema } from "../support/contract";

test("GET /health segue health", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  expectSchema(await res.json(), "health");
});

// O gate e o painel /status leem estes nomes. Renomear quebra o promote.
test("GET /metrics expoe as series que o gate le", async ({ request }) => {
  const res = await request.get("/metrics");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/plain");
  const text = await res.text();
  for (const series of ["http_requests_total", "http_errors_total", "http_error_rate"]) {
    expect(text).toMatch(new RegExp(`^${series} \\d+(\\.\\d+)?$`, "m"));
  }
  expect(text).toMatch(/^app_info\{version="[^"]+"\} 1$/m);
});

test("POST /api/contact segue contact-received", async ({ request }) => {
  const res = await request.post("/api/contact", {
    data: { name: "João Ribeiro", message: "A Granite Mid serve no 42?" },
  });
  expect(res.status()).toBe(200);
  expectSchema(await res.json(), "contact-received");
});

test("POST /api/contact sem mensagem devolve erro no formato padrao", async ({ request }) => {
  const res = await request.post("/api/contact", { data: { name: "João Ribeiro" } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expectSchema(body, "error");
  expect(body.error).toBe("name_and_message_required");
});
