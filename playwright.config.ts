import { defineConfig, devices, type Project } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:8080";
const chrome = devices["Desktop Chrome"];

// Camadas do gate. Rodando sem --project: contract -> smoke -> regression,
// e uma camada vermelha pula as seguintes.
const projects: Project[] = [
  { name: "contract", testDir: "./tests/contract" },
  { name: "smoke", testDir: "./tests/smoke", use: chrome, dependencies: ["contract"] },
  { name: "regression", testDir: "./tests/regression", use: chrome, dependencies: ["smoke"] },
];

if (process.env.GATE_DRILL === "false-positive") {
  projects.push({ name: "drill", testDir: "./tests/drills", use: chrome });
}

// Nightly: mesmas jornadas em outros motores e no celular, quarentena incluida.
if (process.env.CROSS_BROWSER) {
  const journeys = { testDir: "./tests", testMatch: /(smoke|regression)[\\/].*\.spec\.ts/ };
  projects.push(
    { name: "firefox", ...journeys, use: devices["Desktop Firefox"] },
    { name: "webkit", ...journeys, use: devices["Desktop Safari"] },
    { name: "mobile", ...journeys, use: devices["Pixel 7"] },
  );
}

export default defineConfig({
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  grepInvert: process.env.CROSS_BROWSER ? undefined : /@quarantine/,
  reporter: process.env.CI
    ? [
        ["html", { open: "never", title: "Nimbus Shop · Playwright", outputFolder: process.env.PW_HTML_DIR || "playwright-report" }],
        ["github"],
        ["json", { outputFile: process.env.PW_JSON || "playwright-results.json" }],
        ["list"],
      ]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: process.env.CANARY_HEADER ? { "X-Canary": process.env.CANARY_HEADER } : undefined,
  },
  projects,
});
