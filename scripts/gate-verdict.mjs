// Junta o resultado de cada etapa do deploy num veredito e numa classe de falha.
// Em drill o gate nunca promove: o job passa quando a falha cai na classe esperada.
import { appendFileSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const STAGES = [
  ["budget", "budget"],
  ["canary", "deploy"],
  ["analysis10", "sli"],
  ["smoke10", "functional"],
  ["promote50", "deploy"],
  ["analysis50", "sli"],
  ["smoke50", "functional"],
  ["promote100", "deploy"],
  ["soak", "post-promote"],
];

export const DRILL_EXPECTS = {
  "false-positive": "functional",
  "inject-errors": "sli",
  "inject-latency": "sli",
};

export const EXPLAIN = {
  budget: "O stable ja estava acima do error budget. O canary nem comecou.",
  deploy: "O rollout nao chegou no estado esperado (timeout ou erro do controller).",
  sli: "Canary pior que o stable em erro ou latencia. O Argo abortou sozinho no analysis.",
  functional: "SLIs saudaveis, mas o smoke falhou: bug funcional ou teste quebrado. Abra o trace antes de culpar o codigo.",
  "post-promote": "Passou no canary e falhou no soak com 100% do trafego. Rollback para a revisao anterior.",
};

const failed = (outcome) => outcome === "failure" || outcome === "cancelled";

export function judge(outcomes, drill = "none") {
  const hit = STAGES.find(([step]) => failed(outcomes[step]));
  const failureClass = hit ? hit[1] : null;
  const failedAt = hit ? hit[0] : null;

  let verdict;
  if (failureClass === "post-promote") verdict = "ROLLED_BACK";
  else if (failureClass) verdict = "ABORTED";
  else if (drill !== "none") verdict = "ABORTED";
  else if (outcomes.soak === "success") verdict = "PROMOTED";
  else verdict = "INCOMPLETE";

  const result = { verdict, failureClass, failedAt, explain: failureClass ? EXPLAIN[failureClass] : null, drill };

  if (drill !== "none") {
    const expected = DRILL_EXPECTS[drill] || null;
    result.drillExpected = expected;
    result.drillCaught = Boolean(expected) && failureClass === expected;
    result.exitCode = result.drillCaught ? 0 : 1;
  } else {
    result.exitCode = verdict === "PROMOTED" ? 0 : 1;
  }
  return result;
}

function main() {
  const outcomes = Object.fromEntries(STAGES.map(([step]) => [step, process.env[`OUTCOME_${step.toUpperCase()}`] || ""]));
  const result = { ...judge(outcomes, process.env.DRILL || "none"), outcomes };
  console.log(JSON.stringify(result, null, 2));
  if (process.env.OUT) {
    mkdirSync(dirname(process.env.OUT), { recursive: true });
    writeFileSync(process.env.OUT, `${JSON.stringify(result, null, 2)}\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${result.verdict}\nfailure_class=${result.failureClass || ""}\n`);
  }
  process.exit(result.exitCode);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
