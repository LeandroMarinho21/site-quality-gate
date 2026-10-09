# site-quality-gate

Loja de demonstração **Nimbus Shop** (Trail 32L, Apex 800, Granite Mid) com um quality gate completo atrás: pirâmide de testes no PR, canary com Argo Rollouts comparando a revisão nova contra a atual, smoke no canary, soak depois do promote e drills que testam o próprio gate.

O cluster **não fica no ar 24/7**. Cada push em `main` sobe um [kind](https://kind.sigs.k8s.io/) no GitHub Actions, faz o rollout e descarta tudo. Plano gratuito do GitHub, repo público, sem conta de cloud.

A estratégia completa (riscos, camadas, critério de promote, classes de falha) está em [`docs/test-strategy.md`](docs/test-strategy.md).

## O gate

```
PR / push
  unit (node:test)                    regras de pedido, decisão do canary, veredito
  contract → smoke → regression       Playwright; camada vermelha pula as seguintes

main → kind + Ingress NGINX + Argo Rollouts
  error budget do stable              stable ruim = canary nem começa
  canary 10%
    analysis canary vs stable ×3      erro, delta de erro e p95 contra o stable
    smoke com X-Canary: always        confere /health.version == sha
  canary 50%  (de novo)
  100%
    soak: 3 rodadas de smoke          falhou = rollback
```

O analysis roda dentro do cluster, como Job do `AnalysisTemplate`, e bate nos Services `canary` e `stable` com as mesmas sondas, intercaladas. Se o canary piorar, o Argo aborta sozinho; o Actions só lê o resultado e monta o resumo.

Thresholds: erro do canary ≤ 5%, no máximo 2 p.p. acima do stable, p95 ≤ stable × 1,5 + 50 ms, 20 amostras no mínimo.

## Drills

Actions → **deploy** → Run workflow → `drill`:

| drill | o que injeta | tem que cair em |
| --- | --- | --- |
| `inject-errors` | 500 em `/checkout` e `/api/orders` no canary | analysis (`sli`) |
| `inject-latency` | +400 ms por request no canary | analysis (`sli`) |
| `false-positive` | teste que espera "Release 2.0" | smoke (`functional`) |

Em drill nada é promovido. O job fica **verde quando o gate pega o defeito na camada certa** e vermelho quando deixa passar. O resumo mostra a tabela canary vs stable e quais rotas falharam.

## Rodar local

```bash
npm ci
npx playwright install chromium
npm start                      # outra aba
npm test                       # unit + contract + smoke + regression
```

Camadas separadas: `npm run test:unit`, `test:contract`, `test:smoke`, `test:regression`.

Comparar duas revisões na mão:

```bash
PORT=8081 INJECT_LATENCY_MS=300 node app/server.js &
CANARY_URL=http://127.0.0.1:8081 STABLE_URL=http://127.0.0.1:8080 node scripts/canary-compare.mjs
```

Cross-browser como no nightly: `npx playwright install firefox webkit`, depois `CROSS_BROWSER=1 npx playwright test --project=firefox --project=webkit --project=mobile`.

## Layout

- `app/` — servidor HTTP sem dependências; regras em `app/lib/orders.js`
- `contracts/` — JSON Schema das respostas da API
- `tests/unit`, `tests/contract`, `tests/smoke`, `tests/regression`, `tests/drills`
- `tests/support/` — fixtures, ações da loja, dados de teste
- `k8s/` — Rollout, Services, Ingress, AnalysisTemplate
- `scripts/canary-compare.mjs` — comparação canary vs stable (cluster e runner)
- `scripts/gate-verdict.mjs` — veredito e classe de falha
- `.github/workflows/` — `ci.yml`, `deploy.yml`, `nightly.yml`
