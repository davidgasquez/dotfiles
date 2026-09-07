#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--autostart" ]]; then
  exec env CODEX_ELECTRON_START_IN_BACKGROUND=1 /usr/bin/chatgpt
fi

# Explicit launches release the startup-only hiding rule.
hyprctl eval 'hl.window_rule({name="chatgpt-startup",enabled=false})'

# Files and deep links need ChatGPT's normal argument handling.
if (( $# > 0 )); then
  exec /usr/bin/chatgpt "$@"
fi

workspace=$(hyprctl -j activeworkspace | jq -er '.id')

find_window() {
  hyprctl -j clients | jq -r --argjson workspace "${workspace}" '
    [.[] | select((.class | ascii_downcase) == "chatgpt" and .mapped and (.floating | not))]
    | sort_by([(.workspace.id != $workspace), .focusHistoryID])
    | .[0].address // empty
  '
}

focus_window() {
  hyprctl dispatch "hl.dsp.window.move({window=\"address:${window}\",workspace=${workspace},follow=false})"
  hyprctl dispatch "hl.dsp.focus({window=\"address:${window}\"})"
}

window=$(find_window)
if [[ -n "${window}" ]]; then
  focus_window
  exit 0
fi

tray_service=$(busctl --user --no-legend list | awk '
  $3 == "ChatGPT" && $1 ~ /^org\.freedesktop\.StatusNotifierItem-/ { print $1 }
')

if [[ -n "${tray_service}" ]]; then
  busctl --user call "${tray_service}" /StatusNotifierItem \
    org.kde.StatusNotifierItem Activate ii 0 0
else
  /usr/bin/chatgpt &
fi

# Restoring from the tray and cold starts both map the window asynchronously.
for (( attempt = 0; attempt < 150; attempt++ )); do
  window=$(find_window)
  if [[ -n "${window}" ]]; then
    focus_window
    exit 0
  fi
  sleep 0.1
done

printf 'ChatGPT did not open a main window within 15 seconds.\n' >&2
exit 1
