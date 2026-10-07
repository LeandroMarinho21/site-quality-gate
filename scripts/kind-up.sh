#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! kind get clusters 2>/dev/null | grep -qx site-quality-gate; then
  kind create cluster --name site-quality-gate --config "$ROOT/kind-config.yaml"
fi

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.2/deploy/static/provider/kind/deploy.yaml
kubectl create namespace argo-rollouts --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/download/v1.8.3/install.yaml

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

kubectl wait --namespace argo-rollouts \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=argo-rollouts \
  --timeout=180s

echo "controllers ready"
