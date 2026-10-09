#!/usr/bin/env bash
# Error budget do stable: sonda / e /checkout e le o /metrics de um pod.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8080}"
THRESHOLD="${ERROR_RATE_THRESHOLD:-0.05}"
METRICS_FILE="${GATE_METRICS_FILE:-${RUNNER_TEMP:-/tmp}/gate-metrics.json}"

CURL=(curl -s)
if [ -n "${CANARY_HEADER:-}" ]; then
  CURL+=(-H "X-Canary: ${CANARY_HEADER}")
fi

i=0
while [ "$i" -lt 6 ]; do
  "${CURL[@]}" "$BASE/" >/dev/null || true
  "${CURL[@]}" "$BASE/checkout" >/dev/null || true
  i=$((i + 1))
done

BODY=$("${CURL[@]}" "$BASE/metrics")
echo "$BODY"

REQ=$(echo "$BODY" | awk '/^http_requests_total / {print $2}')
ERR=$(echo "$BODY" | awk '/^http_errors_total / {print $2}')
RATE=$(echo "$BODY" | awk '/^http_error_rate / {print $2}')
VER=$(echo "$BODY" | sed -n 's/.*version="\([^"]*\)".*/\1/p' | head -n1)

REQ=${REQ:-0}
ERR=${ERR:-0}
RATE=${RATE:-0}
VER=${VER:-unknown}

echo "requests=$REQ errors=$ERR error_rate=$RATE version=$VER threshold=$THRESHOLD canary_header=${CANARY_HEADER:-}"

mkdir -p "$(dirname "$METRICS_FILE")"
cat > "$METRICS_FILE" <<EOF
{"version":"$VER","requests":$REQ,"errors":$ERR,"error_rate":$RATE,"threshold":$THRESHOLD}
EOF

awk -v r="$RATE" -v t="$THRESHOLD" 'BEGIN { exit (r+0 > t+0) ? 1 : 0 }'
