#!/usr/bin/env bash
# uso: analysis-result.sh NS ROLLOUT OUT_JSON
# Junta o GATE_RESULT de cada Job do AnalysisRun mais recente e falha se o run falhou.
set -euo pipefail
NS="$1"
NAME="$2"
OUT="$3"
mkdir -p "$(dirname "$OUT")"

kubectl argo rollouts get rollout "$NAME" -n "$NS" || true

RUN=$(kubectl get analysisrun -n "$NS" --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1:].metadata.name}')
if [ -z "$RUN" ]; then
  echo "nenhum AnalysisRun encontrado"
  echo '{"run":null,"status":"Missing","samples":[]}' > "$OUT"
  exit 1
fi
STATUS=$(kubectl get analysisrun "$RUN" -n "$NS" -o jsonpath='{.status.phase}')
echo "analysisrun=$RUN phase=$STATUS"

JOBS=$(kubectl get jobs -n "$NS" -o json \
  | jq -r --arg run "$RUN" '.items[] | select(any(.metadata.ownerReferences[]?; .name == $run)) | .metadata.name' \
  | sort)

LOGS=$(mktemp)
for job in $JOBS; do
  echo "--- $job"
  POD=$(kubectl get pods -n "$NS" -l "job-name=$job" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [ -z "$POD" ]; then
    echo "pod do job nao encontrado"
    kubectl get pods -n "$NS" --show-labels | grep -F "$job" || true
    continue
  fi
  kubectl logs -n "$NS" "$POD" > "$LOGS.one" || echo "kubectl logs falhou para $POD"
  grep -v '^GATE_RESULT ' "$LOGS.one" || true
  sed -n 's/^GATE_RESULT //p' "$LOGS.one" >> "$LOGS"
done

jq -s --arg run "$RUN" --arg status "$STATUS" '{run: $run, status: $status, samples: .}' "$LOGS" > "$OUT"

PHASE=$(kubectl get rollout "$NAME" -n "$NS" -o jsonpath='{.status.phase}')
SAMPLES=$(jq '.samples | length' "$OUT")
JOB_COUNT=$(echo "$JOBS" | grep -c . || true)
echo "rollout phase=$PHASE medicoes=$SAMPLES jobs=$JOB_COUNT"

# Analysis verde sem medicao nao e evidencia de nada.
if [ "$STATUS" = "Successful" ] && [ "$SAMPLES" -lt "$JOB_COUNT" ]; then
  echo "analysis aprovou sem GATE_RESULT em todos os jobs: tratando como falha"
  exit 1
fi
[ "$STATUS" = "Successful" ] && [ "$PHASE" != "Degraded" ]
