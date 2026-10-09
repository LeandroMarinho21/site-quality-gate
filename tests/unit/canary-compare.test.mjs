import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, decide, parseHeaders, percentile, summarize } from "../../scripts/canary-compare.mjs";

const healthy = { samples: 30, errors: 0, errorRate: 0, p50: 4, p95: 9 };

test("percentil por nearest-rank", () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(values, 50), 5);
  assert.equal(percentile(values, 95), 10);
  assert.equal(percentile([], 95), null);
});

test("summarize conta erros e latencia", () => {
  const s = summarize([
    { ok: true, ms: 10 },
    { ok: false, ms: 30 },
    { ok: true, ms: 20 },
    { ok: true, ms: 40 },
  ]);
  assert.equal(s.samples, 4);
  assert.equal(s.errors, 1);
  assert.equal(s.errorRate, 0.25);
  assert.equal(s.p95, 40);
});

test("canary igual ao stable passa", () => {
  assert.equal(decide(healthy, healthy).verdict, "pass");
});

test("canary com 5xx no checkout reprova pelo teto e pelo delta", () => {
  const canary = { ...healthy, errors: 10, errorRate: 10 / 30 };
  const result = decide(canary, healthy);
  assert.equal(result.verdict, "fail");
  assert.equal(result.reasons.length, 2);
});

test("stable ja ruim nao aprova canary pior que o teto", () => {
  const stable = { ...healthy, errors: 3, errorRate: 0.1 };
  const canary = { ...healthy, errors: 3, errorRate: 0.1 };
  const result = decide(canary, stable);
  assert.equal(result.verdict, "fail");
  assert.match(result.reasons[0], /teto/);
});

test("delta pequeno dentro do teto passa", () => {
  const canary = { ...healthy, errors: 1, errorRate: 1 / 60 };
  assert.equal(decide({ ...canary, samples: 60 }, { ...healthy, samples: 60 }).verdict, "pass");
});

test("latencia: reprova so acima de stable x ratio + folga", () => {
  const budget = healthy.p95 * DEFAULT_LIMITS.maxLatencyRatio + DEFAULT_LIMITS.latencySlackMs;
  assert.equal(decide({ ...healthy, p95: budget }, healthy).verdict, "pass");
  const slow = decide({ ...healthy, p95: 400 }, healthy);
  assert.equal(slow.verdict, "fail");
  assert.match(slow.reasons[0], /p95/);
});

test("poucas amostras e inconclusivo, nunca pass", () => {
  const result = decide({ ...healthy, samples: 5 }, healthy);
  assert.equal(result.verdict, "inconclusive");
});

test("parseHeaders aceita varios headers", () => {
  assert.deepEqual(parseHeaders("X-Canary: always; X-Trace: gate"), { "X-Canary": "always", "X-Trace": "gate" });
  assert.deepEqual(parseHeaders(""), {});
});
