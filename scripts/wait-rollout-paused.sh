#!/usr/bin/env bash
set -euo pipefail
NS="${1:-site-quality-gate}"
NAME="${2:-site-quality-gate}"
WANT="${3:-Paused}"
IFS=',' read -r -a WANTS <<< "$WANT"

phase_wanted() {
  local p="$1"
  local w
  for w in "${WANTS[@]}"; do
    if [ "$p" = "$w" ]; then
      return 0
    fi
  done
  return 1
}

for _ in $(seq 1 72); do
  PHASE=$(kubectl get rollout "$NAME" -n "$NS" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  echo "rollout phase=${PHASE:-unknown} want=$WANT"
  if phase_wanted "$PHASE"; then
    exit 0
  fi
  if [ "$PHASE" = "Degraded" ]; then
    kubectl argo rollouts get rollout "$NAME" -n "$NS" || true
    exit 1
  fi
  sleep 5
done

echo "timed out waiting for $WANT"
kubectl argo rollouts get rollout "$NAME" -n "$NS" || true
exit 1
