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

for job in $JOBS; do
  echo "--- $job"
  kubectl logs -n "$NS" "job/$job" 2>/dev/null | grep -v '^GATE_RESULT ' || true
done

{ for job in $JOBS; do kubectl logs -n "$NS" "job/$job" 2>/dev/null | sed -n 's/^GATE_RESULT //p' || true; done; } \
  | jq -s --arg run "$RUN" --arg status "$STATUS" '{run: $run, status: $status, samples: .}' > "$OUT"

PHASE=$(kubectl get rollout "$NAME" -n "$NS" -o jsonpath='{.status.phase}')
echo "rollout phase=$PHASE"
[ "$STATUS" = "Successful" ] && [ "$PHASE" != "Degraded" ]
