const fs = require("fs");
const path = require("path");

const out = process.env.GITHUB_STEP_SUMMARY;
if (!out) {
  process.stderr.write("GITHUB_STEP_SUMMARY is not set\n");
  process.exit(0);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function badge(label, value, color) {
  const l = encodeURIComponent(label);
  const v = encodeURIComponent(value);
  return `<img alt="${label} ${value}" src="https://img.shields.io/badge/${l}-${v}-${color}?style=for-the-badge" />`;
}

function outcomeColor(outcome) {
  if (outcome === "success") return "2ea44f";
  if (outcome === "failure") return "d1242f";
  return "6e7781";
}

function outcomeLabel(outcome) {
  if (outcome === "success") return "PASS";
  if (outcome === "failure") return "FAIL";
  return (outcome || "n/a").toUpperCase();
}

function pct(rate) {
  const n = Number(rate);
  if (Number.isNaN(n)) return "n/a";
  return `${(n * 100).toFixed(2)}%`;
}

function tile(label, value, hint) {
  return `<td align="center" width="20%">
  <p><sub>${label}</sub></p>
  <h2>${value}</h2>
  ${hint ? `<p><sub>${hint}</sub></p>` : ""}
</td>`;
}

const kind = process.env.SUMMARY_KIND || "deploy";
const metrics = readJson(process.env.GATE_METRICS_FILE || path.join(process.env.RUNNER_TEMP || ".", "gate-metrics.json")) || {};
const pw = readJson(process.env.PLAYWRIGHT_JSON || "playwright-results.json");
const smoke = process.env.SMOKE_OUTCOME || "";
const analysis = process.env.ANALYSIS_OUTCOME || "";
const metricsOutcome = process.env.METRICS_OUTCOME || "";
const verdict = process.env.GATE_VERDICT || (smoke === "success" && metricsOutcome !== "failure" ? "PROMOTED" : "ABORTED");
const verdictColor = verdict === "PROMOTED" ? "2ea44f" : "d1242f";
const imageTag = process.env.IMAGE_TAG || process.env.GITHUB_SHA?.slice(0, 7) || "local";
const demo = process.env.RUN_FALSE_POSITIVE === "true";

let pwStats = { expected: 0, unexpected: 0, skipped: 0, durationMs: 0, failed: [] };
if (pw?.stats) {
  pwStats.expected = pw.stats.expected || 0;
  pwStats.unexpected = pw.stats.unexpected || 0;
  pwStats.skipped = pw.stats.skipped || 0;
  pwStats.durationMs = pw.stats.duration || 0;
}
if (pw && Array.isArray(pw.suites)) {
  const walk = (suites) => {
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          if (t.status && t.status !== "expected" && t.status !== "skipped") {
            pwStats.failed.push(spec.title);
          }
        }
      }
      walk(suite.suites || []);
    }
  };
  walk(pw.suites);
}

const lines = [];

if (kind === "ci") {
  const ok = pwStats.unexpected === 0 && (process.env.CI_OUTCOME || "success") === "success";
  lines.push(`# Regression gate`);
  lines.push("");
  lines.push(
    [
      badge("tests", ok ? "PASS" : "FAIL", ok ? "2ea44f" : "d1242f"),
      badge("passed", String(pwStats.expected), "2ea44f"),
      badge("failed", String(pwStats.unexpected), pwStats.unexpected ? "d1242f" : "6e7781"),
    ].join(" "),
  );
  lines.push("");
  lines.push(`<table><tr>`);
  lines.push(tile("passed", String(pwStats.expected), "smoke + regressão"));
  lines.push(tile("failed", String(pwStats.unexpected), pwStats.failed[0] || "-"));
  lines.push(tile("skipped", String(pwStats.skipped), "@demo fora do CI"));
  lines.push(tile("duracao", `${(pwStats.durationMs / 1000).toFixed(1)}s`, "Chromium"));
  lines.push(`</tr></table>`);
  if (pwStats.failed.length) {
    lines.push("");
    lines.push(`### Falhas`);
    for (const title of pwStats.failed) lines.push(`- ${title}`);
  }
  lines.push("");
  lines.push(`> Relatorio HTML do Playwright esta nos artifacts deste run.`);
} else {
  lines.push(`# Canary quality gate`);
  lines.push("");
  lines.push(
    [
      badge("gate", verdict, verdictColor),
      badge("metrics", outcomeLabel(metricsOutcome || "success"), outcomeColor(metricsOutcome || "success")),
      badge("analysis", outcomeLabel(analysis || "success"), outcomeColor(analysis || "success")),
      badge("smoke", outcomeLabel(smoke || "n/a"), outcomeColor(smoke || "n/a")),
    ].join(" "),
  );
  lines.push("");
  if (demo) {
    lines.push(`> Demo de falso positivo: spec \`@demo\` ativo. Metricas do app podem estar saudaveis mesmo com o job vermelho.`);
    lines.push("");
  }
  if (process.env.INJECT_ERRORS === "true") {
    lines.push(`> Canary com INJECT_ERRORS: /checkout 5xx, error_rate acima do threshold, abort por metrica.`);
    lines.push("");
  }
  lines.push(`<table><tr>`);
  lines.push(tile("versao", metrics.version || imageTag, "APP_VERSION"));
  lines.push(tile("requests", String(metrics.requests ?? "-"), "probe"));
  lines.push(tile("erros", String(metrics.errors ?? "-"), "HTTP 4xx/5xx"));
  lines.push(tile("error rate", pct(metrics.error_rate), `limite ${pct(metrics.threshold ?? 0.05)}`));
  lines.push(`</tr></table>`);
  lines.push("");
  lines.push(`### Fluxo`);
  lines.push("");
  lines.push("```mermaid");
  lines.push("flowchart LR");
  lines.push("  B[baseline] --> C10[canary 10%]");
  lines.push("  C10 --> P[pause]");
  if (verdict === "PROMOTED") {
    lines.push("  P --> G{metrics + smoke}");
    lines.push("  G -->|pass| C50[canary 50%]");
    lines.push("  C50 --> H[100% Healthy]");
  } else {
    lines.push("  P --> G{metrics + smoke}");
    lines.push("  G -->|fail| A[abort]");
  }
  lines.push("```");
  lines.push("");
  lines.push(`### Checks`);
  lines.push("");
  lines.push("| etapa | resultado |");
  lines.push("| --- | --- |");
  lines.push(`| metricas \`/metrics\` | ${outcomeLabel(metricsOutcome || "success")} |`);
  lines.push(`| analysis job | ${outcomeLabel(analysis || "success")} |`);
  lines.push(`| Playwright smoke | ${outcomeLabel(smoke || "n/a")} |`);
  lines.push(`| rollout | **${verdict}** |`);
  if (pw) {
    lines.push("");
    lines.push(`Playwright: **${pwStats.expected}** ok · **${pwStats.unexpected}** falhou · ${((pwStats.durationMs || 0) / 1000).toFixed(1)}s`);
    if (pwStats.failed.length) {
      lines.push("");
      for (const title of pwStats.failed) lines.push(`- ${title}`);
    }
  }
  lines.push("");
  lines.push(`<sub>imagem <code>${imageTag}</code> · threshold error_rate ${pct(metrics.threshold ?? 0.05)}</sub>`);
}

fs.appendFileSync(out, `${lines.join("\n")}\n`);
