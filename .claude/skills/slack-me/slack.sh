#!/usr/bin/env bash
# Post to Slack and optionally wait for a threaded reply.
# The Authorization header is injected automatically; do not add one.
#
#   slack.sh post [--thread <ts>] "<text>"   post, print message ts
#   slack.sh ask  [--thread <ts>] "<text>"   post, then wait for a reply in the thread
#   slack.sh wait <ts> [after-ts]            keep waiting for a reply to <ts>
#
# Exit codes: 0 ok, 1 Slack API error, 2 timed out waiting for a reply.
set -euo pipefail

CHANNEL="${SLACK_CHANNEL:-C0C7L8PR00H}"  # #bruce-bot-collab
API="https://slack.com/api"
POLL_SECONDS="${SLACK_POLL_SECONDS:-20}"
POLL_TRIES="${SLACK_POLL_TRIES:-27}"

die() { echo "slack: $*" >&2; exit 1; }

post() {
  local thread="$1" text="$2" body resp
  body=$(jq -n --arg c "$CHANNEL" --arg t "$text" --arg th "$thread" \
    '{channel: $c, text: $t} + (if $th != "" then {thread_ts: $th} else {} end)')
  resp=$(curl -s -m 30 -X POST "$API/chat.postMessage" \
    -H "Content-Type: application/json; charset=utf-8" --data-binary "$body")
  [ "$(jq -r '.ok' <<<"$resp")" = "true" ] || die "post failed: $(jq -c '{error, needed}' <<<"$resp")"
  jq -r '.ts' <<<"$resp"
}

# wait for the first reply in thread <root> newer than <after>
wait_reply() {
  local root="$1" after="${2:-$1}" resp reply
  for _ in $(seq 1 "$POLL_TRIES"); do
    resp=$(curl -s -m 20 "$API/conversations.replies?channel=$CHANNEL&ts=$root&oldest=$after&limit=50")
    [ "$(jq -r '.ok' <<<"$resp")" = "true" ] || die "poll failed: $(jq -c '{error, needed}' <<<"$resp")"
    # replies from people only: skip the root/our own message and bot posts
    reply=$(jq -c --arg a "$after" \
      '[.messages[] | select((.ts | tonumber) > ($a | tonumber) and (.bot_id | not))] | first // empty' <<<"$resp")
    if [ -n "$reply" ]; then
      jq -r '"reply from \(.user) at \(.ts):\n\(.text)"' <<<"$reply"
      return 0
    fi
    sleep "$POLL_SECONDS"
  done
  echo "slack: no reply yet to $root (resume with: slack.sh wait $root $after)" >&2
  exit 2
}

cmd="${1:-}"; shift || true
thread=""
if [ "${1:-}" = "--thread" ]; then thread="$2"; shift 2; fi

case "$cmd" in
  post)
    [ -n "${1:-}" ] || die "missing message text"
    post "$thread" "$1"
    ;;
  ask)
    [ -n "${1:-}" ] || die "missing message text"
    ts=$(post "$thread" "$1")
    echo "posted ts=$ts; waiting for reply..."
    wait_reply "${thread:-$ts}" "$ts"
    ;;
  wait)
    [ -n "${1:-}" ] || die "missing thread ts"
    wait_reply "$1" "${2:-$1}"
    ;;
  *)
    die "usage: slack.sh post|ask [--thread <ts>] \"<text>\" | slack.sh wait <ts> [after-ts]"
    ;;
esac
