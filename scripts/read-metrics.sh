#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://127.0.0.1:8080}"
THRESHOLD="${ERROR_RATE_THRESHOLD:-0.05}"

i=0
while [ "$i" -lt 6 ]; do
  curl -sf "$BASE/" >/dev/null
  i=$((i + 1))
done

BODY=$(curl -sf "$BASE/metrics")
echo "$BODY"

REQ=$(echo "$BODY" | awk '/^http_requests_total / {print $2}')
ERR=$(echo "$BODY" | awk '/^http_errors_total / {print $2}')
RATE=$(echo "$BODY" | awk '/^http_error_rate / {print $2}')
VER=$(echo "$BODY" | sed -n 's/.*version="\([^"]*\)".*/\1/p' | head -n1)

echo "requests=${REQ:-0} errors=${ERR:-0} error_rate=${RATE:-0} version=${VER:-unknown} threshold=$THRESHOLD"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Quality gate metrics"
    echo ""
    echo "| campo | valor |"
    echo "| --- | --- |"
    echo "| version | ${VER:-unknown} |"
    echo "| requests | ${REQ:-0} |"
    echo "| errors | ${ERR:-0} |"
    echo "| error_rate | ${RATE:-0} |"
    echo "| threshold | $THRESHOLD |"
  } >> "$GITHUB_STEP_SUMMARY"
fi

awk -v r="${RATE:-0}" -v t="$THRESHOLD" 'BEGIN { exit (r+0 > t+0) ? 1 : 0 }'
