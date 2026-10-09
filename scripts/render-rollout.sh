#!/usr/bin/env bash
# uso: render-rollout.sh IMAGE VERSION [INJECT_ERRORS] [INJECT_LATENCY_MS]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="$1"
VERSION="$2"
INJECT_ERRORS="${3:-0}"
INJECT_LATENCY_MS="${4:-0}"

sed -e "s|image: site-quality-gate:local|image: ${IMAGE}|" \
    -e "s|APP_VERSION_VALUE|${VERSION}|" \
    -e "s|INJECT_ERRORS_VALUE|${INJECT_ERRORS}|" \
    -e "s|INJECT_LATENCY_MS_VALUE|${INJECT_LATENCY_MS}|" \
    "$ROOT/k8s/rollout.yaml"
