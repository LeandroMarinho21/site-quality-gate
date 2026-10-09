// Compara canary e stable com as mesmas sondas, intercaladas no tempo.
// Roda no Job do AnalysisTemplate (node:22-alpine, via ConfigMap) e no runner do Actions.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_LIMITS = {
  maxErrorRate: 0.05,
  maxErrorDelta: 0.02,
  maxLatencyRatio: 1.5,
  latencySlackMs: 50,
  minSamples: 20,
};

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

export function summarize(samples) {
  const errors = samples.filter((s) => !s.ok).length;
  const ms = samples.map((s) => s.ms);
  return {
    samples: samples.length,
    errors,
    errorRate: samples.length ? errors / samples.length : 0,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
  };
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const msf = (n) => `${Math.round(n)}ms`;

export function decide(canary, stable, limits = DEFAULT_LIMITS) {
  if (canary.samples < limits.minSamples || stable.samples < limits.minSamples) {
    return {
      verdict: "inconclusive",
      reasons: [`amostras insuficientes (canary ${canary.samples}, stable ${stable.samples}, minimo ${limits.minSamples})`],
    };
  }
  const reasons = [];
  const errorDelta = canary.errorRate - stable.errorRate;
  const latencyBudget = stable.p95 * limits.maxLatencyRatio + limits.latencySlackMs;

  if (canary.errorRate > limits.maxErrorRate) {
    reasons.push(`error rate do canary ${pct(canary.errorRate)} acima do teto ${pct(limits.maxErrorRate)}`);
  }
  if (errorDelta > limits.maxErrorDelta) {
    reasons.push(`canary erra ${pct(errorDelta)} a mais que o stable (tolerancia ${pct(limits.maxErrorDelta)})`);
  }
  if (canary.p95 > latencyBudget) {
    reasons.push(`p95 do canary ${msf(canary.p95)} acima de ${msf(latencyBudget)} (stable ${msf(stable.p95)} x${limits.maxLatencyRatio} + ${limits.latencySlackMs}ms)`);
  }
  return { verdict: reasons.length ? "fail" : "pass", reasons, errorDelta, latencyBudget };
}

export function parseHeaders(raw) {
  const headers = {};
  for (const part of String(raw || "").split(";")) {
    const i = part.indexOf(":");
    if (i > 0) headers[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return headers;
}

async function probe(base, path, headers, timeoutMs) {
  const started = performance.now();
  try {
    const res = await fetch(new URL(path, base), { headers, signal: AbortSignal.timeout(timeoutMs) });
    await res.arrayBuffer();
    return { path, ok: res.status < 400, status: res.status, ms: performance.now() - started };
  } catch {
    return { path, ok: false, status: 0, ms: performance.now() - started };
  }
}

function byPath(samples) {
  const out = {};
  for (const s of samples) (out[s.path] ||= []).push(s);
  return Object.fromEntries(Object.entries(out).map(([p, list]) => [p, summarize(list)]));
}

function round(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)));
}

export async function compare(config) {
  const canarySamples = [];
  const stableSamples = [];
  for (let i = 0; i < config.rounds; i += 1) {
    for (const path of config.paths) {
      const [c, s] = await Promise.all([
        probe(config.canaryUrl, path, config.canaryHeaders, config.timeoutMs),
        probe(config.stableUrl, path, config.stableHeaders, config.timeoutMs),
      ]);
      canarySamples.push(c);
      stableSamples.push(s);
    }
  }
  const canary = summarize(canarySamples);
  const stable = summarize(stableSamples);
  const decision = decide(canary, stable, config.limits);
  return round({
    at: new Date().toISOString(),
    verdict: decision.verdict,
    reasons: decision.reasons,
    limits: config.limits,
    canary: { ...canary, byPath: byPath(canarySamples) },
    stable: { ...stable, byPath: byPath(stableSamples) },
  });
}

function configFromEnv(env) {
  const num = (key, fallback) => (env[key] === undefined || env[key] === "" ? fallback : Number(env[key]));
  if (!env.CANARY_URL || !env.STABLE_URL) throw new Error("CANARY_URL e STABLE_URL sao obrigatorios");
  return {
    canaryUrl: env.CANARY_URL,
    stableUrl: env.STABLE_URL,
    canaryHeaders: parseHeaders(env.CANARY_HEADERS),
    stableHeaders: parseHeaders(env.STABLE_HEADERS),
    paths: (env.PROBE_PATHS || "/,/api/products,/checkout").split(",").map((p) => p.trim()),
    rounds: num("PROBE_ROUNDS", 10),
    timeoutMs: num("PROBE_TIMEOUT_MS", 3000),
    limits: {
      maxErrorRate: num("MAX_ERROR_RATE", DEFAULT_LIMITS.maxErrorRate),
      maxErrorDelta: num("MAX_ERROR_DELTA", DEFAULT_LIMITS.maxErrorDelta),
      maxLatencyRatio: num("MAX_LATENCY_RATIO", DEFAULT_LIMITS.maxLatencyRatio),
      latencySlackMs: num("LATENCY_SLACK_MS", DEFAULT_LIMITS.latencySlackMs),
      minSamples: num("MIN_SAMPLES", DEFAULT_LIMITS.minSamples),
    },
  };
}

async function main() {
  const result = await compare(configFromEnv(process.env));
  const line = (name, s) =>
    `${name.padEnd(7)} samples=${s.samples} errors=${s.errors} error_rate=${pct(s.errorRate)} p50=${msf(s.p50)} p95=${msf(s.p95)}`;
  console.log(line("canary", result.canary));
  console.log(line("stable", result.stable));
  console.log(`verdict=${result.verdict}`);
  for (const r of result.reasons) console.log(`  - ${r}`);
  console.log(`GATE_RESULT ${JSON.stringify(result)}`);
  if (process.env.OUT) {
    mkdirSync(dirname(process.env.OUT), { recursive: true });
    writeFileSync(process.env.OUT, `${JSON.stringify(result, null, 2)}\n`);
  }
  process.exit(result.verdict === "pass" ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
