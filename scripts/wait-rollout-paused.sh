#!/usr/bin/env bash
set -euo pipefail
NS="${1:-site-quality-gate}"
NAME="${2:-site-quality-gate}"
WANT="${3:-Paused}"

for _ in $(seq 1 60); do
  PHASE=$(kubectl get rollout "$NAME" -n "$NS" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  echo "rollout phase=${PHASE:-unknown} want=$WANT"
  if [ "$PHASE" = "$WANT" ]; then
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
