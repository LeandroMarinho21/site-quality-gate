const fs = require("fs");
const path = require("path");

const out = process.env.GITHUB_STEP_SUMMARY;
if (!out) {
  process.stderr.write("GITHUB_STEP_SUMMARY is not set\n");
  process.exit(0);
}

const GREEN = "2ea44f";
const RED = "d1242f";
const GREY = "6e7781";
const AMBER = "bf8700";

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function badge(label, value, color) {
  const enc = (s) => encodeURIComponent(String(s).replace(/-/g, "--"));
  return `<img alt="${label} ${value}" src="https://img.shields.io/badge/${enc(label)}-${enc(value)}-${color}?style=for-the-badge" />`;
}

const pct = (n) => (n === undefined || n === null || Number.isNaN(Number(n)) ? "n/a" : `${(Number(n) * 100).toFixed(1)}%`);
const ms = (n) => (n === undefined || n === null ? "n/a" : `${Math.round(n)} ms`);
const secs = (n) => `${((n || 0) / 1000).toFixed(1)}s`;

function outcomeCell(outcome) {
  if (outcome === "success") return "PASS";
  if (outcome === "failure") return "**FAIL**";
  if (outcome === "skipped") return "pulado";
  if (outcome === "cancelled") return "cancelado";
  return "-";
}

// Agrupa o JSON reporter do Playwright por projeto e detecta instabilidade entre repeticoes.
function playwrightStats(report) {
  const projects = new Map();
  const runs = new Map();
  if (!report) return { projects, flaky: [] };
  const walk = (suites, file) => {
    for (const suite of suites || []) {
      const f = suite.file || file;
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          const name = t.projectName || "default";
          const p = projects.get(name) || { passed: 0, failed: 0, skipped: 0, flaky: 0, durationMs: 0, failures: [] };
          const duration = (t.results || []).reduce((sum, r) => sum + (r.duration || 0), 0);
          p.durationMs += duration;
          if (t.status === "expected") p.passed += 1;
          else if (t.status === "skipped") p.skipped += 1;
          else if (t.status === "flaky") p.flaky += 1;
          else {
            p.failed += 1;
            if (!p.failures.includes(spec.title)) p.failures.push(spec.title);
          }
          projects.set(name, p);
          const key = `${name} › ${f} › ${spec.title}`;
          const r = runs.get(key) || { ok: 0, bad: 0 };
          if (t.status === "expected") r.ok += 1;
          else if (t.status !== "skipped") r.bad += 1;
          runs.set(key, r);
        }
      }
      walk(suite.suites, f);
    }
  };
  walk(report.suites, "");
  const flaky = [...runs].filter(([, r]) => r.ok > 0 && r.bad > 0).map(([key]) => key);
  return { projects, flaky };
}

function layerTable(projects, order) {
  const names = order.filter((n) => projects.has(n)).concat([...projects.keys()].filter((n) => !order.includes(n)));
  const lines = ["| camada | passou | falhou | nao rodou | tempo |", "| --- | ---: | ---: | ---: | ---: |"];
  for (const name of names) {
    const p = projects.get(name);
    lines.push(`| ${name} | ${p.passed} | ${p.failed ? `**${p.failed}**` : 0} | ${p.skipped} | ${secs(p.durationMs)} |`);
  }
  return lines;
}

function failureList(projects) {
  const lines = [];
  for (const [name, p] of projects) {
    for (const title of p.failures) lines.push(`- \`${name}\` ${title}`);
  }
  return lines.length ? ["", "### Falhas", "", ...lines] : [];
}

function unitSummary() {
  const tap = fs.existsSync(process.env.UNIT_TAP || "") ? fs.readFileSync(process.env.UNIT_TAP, "utf8") : "";
  const count = (key) => Number((tap.match(new RegExp(`^# ${key} (\\d+(?:\\.\\d+)?)`, "m")) || [])[1] || 0);
  const pass = count("pass");
  const fail = count("fail");
  const failures = [...tap.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((m) => m[1]).slice(0, 15);
  const lines = ["# Unit", ""];
  lines.push([badge("unit", fail ? "FAIL" : "PASS", fail ? RED : GREEN), badge("testes", pass + fail, GREY), badge("tempo", `${Math.round(count("duration_ms"))} ms`, GREY)].join(" "));
  lines.push("", "Regras de pedido e contato, decisao canary vs stable e veredito do gate. Sem servidor, sem browser.");
  if (failures.length) lines.push("", "### Falhas", "", ...failures.map((f) => `- ${f}`));
  return lines;
}

function ciSummary() {
  const { projects } = playwrightStats(readJson(process.env.PW_JSON || "playwright-results.json"));
  const failed = [...projects.values()].some((p) => p.failed) || process.env.CI_OUTCOME === "failure";
  const lines = ["# Contract → smoke → regression", ""];
  lines.push(badge("camadas", failed ? "FAIL" : "PASS", failed ? RED : GREEN));
  lines.push("", ...layerTable(projects, ["contract", "smoke", "regression"]));
  lines.push("", "> Cada camada depende da anterior: contrato vermelho nem abre o browser. Regressao inclui axe (WCAG A/AA).");
  lines.push(...failureList(projects));
  lines.push("", "Relatorio HTML e traces nos artifacts deste run.");
  return lines;
}

function nightlySummary() {
  const { projects, flaky } = playwrightStats(readJson(process.env.PW_JSON || "playwright-results.json"));
  const failed = [...projects.values()].some((p) => p.failed) || process.env.CI_OUTCOME === "failure";
  const lines = ["# Nightly cross-browser", ""];
  lines.push([badge("nightly", failed ? "FAIL" : "PASS", failed ? RED : GREEN), badge("instaveis", flaky.length, flaky.length ? AMBER : GREY)].join(" "));
  lines.push("", ...layerTable(projects, ["firefox", "webkit", "mobile"]));
  if (flaky.length) {
    lines.push("", "### Instaveis (passou e falhou no mesmo run)", "", ...flaky.map((k) => `- ${k}`));
    lines.push("", "> Teste instavel ganha dono: corrige ou vai para `@quarantine` com prazo. Nao se resolve com retry.");
  }
  lines.push(...failureList(projects));
  return lines;
}

const STAGE_LABELS = {
  budget: "error budget do stable",
  canary: "canary 10% no ar",
  analysis10: "analysis canary vs stable (10%)",
  smoke10: "smoke no canary (10%)",
  promote50: "canary 50%",
  analysis50: "analysis canary vs stable (50%)",
  smoke50: "smoke no canary (50%)",
  promote100: "100% do trafego",
  soak: "soak pos-promote",
};

function analysisRows(label, file) {
  const data = readJson(file);
  if (!data) return [];
  if (!data.samples || !data.samples.length) return [`| ${label} | - | sem medicoes (${data.status}) | | | | |`];
  return data.samples.map((s, i) => {
    const mark = s.verdict === "pass" ? "PASS" : `**${s.verdict.toUpperCase()}**`;
    return `| ${label} | ${i + 1}/${data.samples.length} | ${pct(s.canary.errorRate)} | ${pct(s.stable.errorRate)} | ${ms(s.canary.p95)} | ${ms(s.stable.p95)} | ${mark} |`;
  });
}

function analysisReasons(files) {
  const lines = [];
  for (const file of files) {
    const data = readJson(file);
    const bad = (data?.samples || []).find((s) => s.verdict !== "pass");
    if (!bad) continue;
    lines.push(...bad.reasons.map((r) => `- ${r}`));
    const paths = Object.entries(bad.canary.byPath || {})
      .filter(([, p]) => p.errors > 0)
      .map(([p, s]) => `\`${p}\` ${s.errors}/${s.samples}`);
    if (paths.length) lines.push(`- erros do canary por rota: ${paths.join(", ")}`);
    break;
  }
  return lines;
}

function deploySummary() {
  const dir = process.env.GATE_DIR || path.join(process.env.RUNNER_TEMP || ".", "gate");
  const v = readJson(path.join(dir, "verdict.json")) || { verdict: "INCOMPLETE", outcomes: {}, drill: process.env.DRILL || "none" };
  const drill = v.drill && v.drill !== "none" ? v.drill : null;
  const tag = process.env.IMAGE_TAG || "local";
  const color = v.verdict === "PROMOTED" ? GREEN : v.verdict === "INCOMPLETE" ? GREY : RED;

  const lines = [drill ? `# Drill do gate: ${drill}` : "# Canary quality gate", ""];
  const badges = [badge("rollout", v.verdict, color)];
  if (v.failureClass) badges.push(badge("falha", v.failureClass, RED));
  if (drill) badges.push(badge("drill", v.drillCaught ? "PEGO" : "PASSOU DIRETO", v.drillCaught ? GREEN : RED));
  lines.push(badges.join(" "), "");

  if (drill) {
    lines.push(
      v.drillCaught
        ? `> O gate barrou o defeito injetado na camada esperada (\`${v.drillExpected}\`). Job verde = o gate funciona. Nada foi promovido.`
        : `> O defeito injetado era para cair em \`${v.drillExpected}\` e caiu em \`${v.failureClass || "nenhuma"}\`. O gate esta cego para esse tipo de falha.`,
      "",
    );
  }
  if (v.explain) lines.push(`**Por que:** ${v.explain}`, "");

  const files = [path.join(dir, "analysis-10.json"), path.join(dir, "analysis-50.json")];
  const rows = [...analysisRows("10%", files[0]), ...analysisRows("50%", files[1])];
  if (rows.length) {
    lines.push("### Canary vs stable", "");
    lines.push("| degrau | medicao | erro canary | erro stable | p95 canary | p95 stable | resultado |");
    lines.push("| --- | --- | ---: | ---: | ---: | ---: | --- |");
    lines.push(...rows);
    const reasons = analysisReasons(files);
    if (reasons.length) lines.push("", ...reasons);
    const limits = readJson(files[0])?.samples?.[0]?.limits;
    if (limits) {
      lines.push("", `<sub>reprova se erro do canary > ${pct(limits.maxErrorRate)}, se erra ${pct(limits.maxErrorDelta)} a mais que o stable, ou se p95 > stable x${limits.maxLatencyRatio} + ${limits.latencySlackMs} ms</sub>`);
    }
    lines.push("");
  }

  lines.push("### Etapas", "", "| etapa | resultado |", "| --- | --- |");
  for (const [key, label] of Object.entries(STAGE_LABELS)) {
    const outcome = v.outcomes?.[key];
    if (!outcome) continue;
    lines.push(`| ${label} | ${outcomeCell(outcome)}${v.failedAt === key ? " ← primeira falha" : ""} |`);
  }

  const smokeFailures = [];
  for (const name of ["smoke-10.json", "smoke-50.json", "soak-1.json", "soak-2.json", "soak-3.json"]) {
    const { projects } = playwrightStats(readJson(path.join(dir, name)));
    for (const [project, p] of projects) for (const t of p.failures) smokeFailures.push(`- \`${name.replace(".json", "")}\` \`${project}\` ${t}`);
  }
  if (smokeFailures.length) lines.push("", "### Testes vermelhos", "", ...smokeFailures);

  const budget = readJson(path.join(dir, "stable-budget.json"));
  lines.push("");
  lines.push(`<sub>imagem <code>${tag}</code> · smoke valida <code>/health.version == ${tag}</code> com <code>X-Canary: always</code>${budget ? ` · error rate do stable antes do canary ${pct(budget.error_rate)}` : ""}</sub>`);
  return lines;
}

const kind = process.env.SUMMARY_KIND || "deploy";
const builders = { unit: unitSummary, ci: ciSummary, nightly: nightlySummary, deploy: deploySummary };
fs.appendFileSync(out, `${(builders[kind] || deploySummary)().join("\n")}\n`);
