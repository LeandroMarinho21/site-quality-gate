#!/usr/bin/env bash
# uso: wait-rollout-phase.sh NS ROLLOUT FASES [MIN_STEP]
# FASES separadas por virgula (ex.: Paused,Degraded). Com MIN_STEP, Paused so vale
# a partir desse degrau: logo depois de um promote a fase ainda e Paused no degrau antigo.
set -euo pipefail
NS="${1:-site-quality-gate}"
NAME="${2:-site-quality-gate}"
WANT="${3:-Paused}"
MIN_STEP="${4:-0}"
IFS=',' read -r -a WANTS <<< "$WANT"

phase_wanted() {
  local w
  for w in "${WANTS[@]}"; do
    [ "$1" = "$w" ] && return 0
  done
  return 1
}

for _ in $(seq 1 90); do
  PHASE=$(kubectl get rollout "$NAME" -n "$NS" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  STEP=$(kubectl get rollout "$NAME" -n "$NS" -o jsonpath='{.status.currentStepIndex}' 2>/dev/null || true)
  echo "rollout phase=${PHASE:-unknown} step=${STEP:-?} want=$WANT min_step=$MIN_STEP"
  if phase_wanted "$PHASE"; then
    if [ "$PHASE" != "Paused" ] || [ "${STEP:-0}" -ge "$MIN_STEP" ]; then
      exit 0
    fi
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
