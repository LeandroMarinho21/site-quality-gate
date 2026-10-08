# site-quality-gate

Loja de demonstração **Nimbus Shop** (Trail 32L, Apex 800, Granite Mid). O quality gate continua por trás: regressão no PR, canary com peso de tráfego, smoke e métricas antes de promover.

Fluxos nos testes: busca “lanterna”, filtro de calçados, sacola Trail + Apex, checkout da Mariana Alves (CEP 01310-100) e contato do João Ribeiro sobre a Granite.

O cluster **não fica no ar 24/7**. Cada push em `main` sobe um [kind](https://kind.sigs.k8s.io/) no GitHub Actions, aplica um [Argo Rollouts](https://argo-rollouts.readthedocs.io/) canary (10% → pause → 50% → pause → 100%), lê `/metrics` e só então promove. Tudo no plano gratuito do GitHub, repo público, sem conta de cloud.

## Como o gate funciona

```
PR  → Docker Compose + Playwright (smoke e regressão)
main → kind + Ingress NGINX + Argo Rollouts
     → canary 10% → analysis error_rate (service canary)
     → pause
     → smoke com header X-Canary: always
     → promote ou abort
```

O smoke do deploy manda `X-Canary: always` no Ingress, então as requests batem no replica novo — não na mistura 10/90. O AnalysisTemplate do Argo consulta o Service canary direto. Pause de 10 min é teto; o Actions promove antes disso.

Métricas vêm do próprio app (`GET /metrics` e `/status`). O job do Actions imprime `requests`, `errors`, `error_rate` e o threshold (5%). Sem Prometheus nem Grafana.

## Rodar local

```bash
docker compose up --build
npm ci
npx playwright install chromium
npm test
```

App em `http://127.0.0.1:8080`. Canary local (opcional, precisa de Docker, kind e kubectl):

```bash
bash scripts/kind-up.sh
```

## Falso positivo (demo, depois apague)

Há um spec `@demo` em `tests/smoke/demo-false-positive.spec.ts` que espera o título **Release 2.0** (o site está em 1.0). Ele **não** roda no CI de PR.

Para gravar um job vermelho depois do verde:

1. Espere o `deploy` em `main` ficar verde.
2. Actions → **deploy** → Run workflow → marque `run_false_positive`.
3. O smoke falha, o rollout dá abort, as métricas continuam abaixo do threshold.
4. Apague o spec, o input no workflow e este parágrafo.

## Vermelho real (métrica)

Actions → **deploy** → Run workflow → marque `inject_errors`. O canary sobe com `INJECT_ERRORS=1`, `/checkout` devolve 500, o analysis aborta o rollout e o job fica vermelho com error_rate acima de 5%.

## Layout

- `app/` — servidor HTTP e páginas
- `tests/smoke` e `tests/regression` — Playwright
- `k8s/` — Rollout, Services, Ingress, analysis
- `.github/workflows/ci.yml` e `deploy.yml`
