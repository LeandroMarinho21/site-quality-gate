import test from "node:test";
import assert from "node:assert/strict";
import { judge } from "../../scripts/gate-verdict.mjs";

const allGreen = {
  budget: "success",
  canary: "success",
  analysis10: "success",
  smoke10: "success",
  promote50: "success",
  analysis50: "success",
  smoke50: "success",
  promote100: "success",
  soak: "success",
};

test("tudo verde promove", () => {
  const r = judge(allGreen);
  assert.equal(r.verdict, "PROMOTED");
  assert.equal(r.exitCode, 0);
});

test("analysis vermelho no 10% e falha de SLI", () => {
  const r = judge({ ...allGreen, analysis10: "failure", smoke10: "skipped", promote50: "skipped", soak: "skipped" });
  assert.equal(r.verdict, "ABORTED");
  assert.equal(r.failureClass, "sli");
  assert.equal(r.failedAt, "analysis10");
  assert.equal(r.exitCode, 1);
});

test("smoke vermelho com SLI verde e falha funcional", () => {
  const r = judge({ ...allGreen, smoke10: "failure", promote50: "skipped", soak: "skipped" });
  assert.equal(r.failureClass, "functional");
});

test("a primeira etapa vermelha decide a classe", () => {
  const r = judge({ ...allGreen, analysis50: "failure", smoke50: "failure" });
  assert.equal(r.failedAt, "analysis50");
});

test("error budget estourado nem sobe canary", () => {
  const r = judge({ budget: "failure" });
  assert.equal(r.failureClass, "budget");
});

test("soak vermelho depois de 100% vira rollback", () => {
  const r = judge({ ...allGreen, soak: "failure" });
  assert.equal(r.verdict, "ROLLED_BACK");
  assert.equal(r.failureClass, "post-promote");
});

test("etapas puladas sem falha nao contam como promovido", () => {
  const r = judge({ ...allGreen, soak: "skipped" });
  assert.equal(r.verdict, "INCOMPLETE");
  assert.equal(r.exitCode, 1);
});

test("cancelado conta como falha", () => {
  assert.equal(judge({ ...allGreen, smoke10: "cancelled" }).failureClass, "functional");
});

test.describe("drills", () => {
  const atCanary = { budget: "success", canary: "success" };

  test("inject-errors pego pelo analysis passa o drill", () => {
    const r = judge({ ...atCanary, analysis10: "failure", smoke10: "skipped" }, "inject-errors");
    assert.equal(r.verdict, "ABORTED");
    assert.equal(r.drillCaught, true);
    assert.equal(r.exitCode, 0);
  });

  test("inject-latency que so o smoke pegasse reprova o drill", () => {
    const r = judge({ ...atCanary, analysis10: "success", smoke10: "failure" }, "inject-latency");
    assert.equal(r.drillCaught, false);
    assert.equal(r.exitCode, 1);
  });

  test("false-positive precisa de SLI verde e smoke vermelho", () => {
    const r = judge({ ...atCanary, analysis10: "success", smoke10: "failure" }, "false-positive");
    assert.equal(r.failureClass, "functional");
    assert.equal(r.drillCaught, true);
  });

  test("drill que passa em tudo e um gate cego", () => {
    const r = judge({ ...atCanary, analysis10: "success", smoke10: "success" }, "inject-errors");
    assert.equal(r.verdict, "ABORTED");
    assert.equal(r.drillCaught, false);
    assert.equal(r.exitCode, 1);
  });
});
