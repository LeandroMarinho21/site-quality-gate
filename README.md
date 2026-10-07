# site-quality-gate

Portal de teste (Nimbus Shop) usado para exercitar um quality gate: regressão no PR, canary com peso de tráfego no deploy, smoke e métricas antes de promover.

O cluster **não fica no ar 24/7**. Cada push em `main` sobe um [kind](https://kind.sigs.k8s.io/) no GitHub Actions, aplica um [Argo Rollouts](https://argo-rollouts.readthedocs.io/) canary (10% → pause → 50% → pause → 100%), lê `/metrics` e só então promove. Tudo no plano gratuito do GitHub, repo público, sem conta de cloud.

## Como o gate funciona

```
PR  → Docker Compose + Playwright (smoke e regressão)
main → kind + Ingress NGINX + Argo Rollouts
     → canary 10% → pause
     → error_rate + smoke
     → promote ou abort
```

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

## Layout

- `app/` — servidor HTTP e páginas
- `tests/smoke` e `tests/regression` — Playwright
- `k8s/` — Rollout, Services, Ingress, analysis
- `.github/workflows/ci.yml` e `deploy.yml`
