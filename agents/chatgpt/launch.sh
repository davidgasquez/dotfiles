#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--autostart" ]]; then
  # Match the window directly: exec rules depend on the launcher's PID.
  hyprctl eval 'hl.window_rule({name="chatgpt-startup",enabled=true,match={class="^chatgpt$"},workspace="special:chatgpt-startup silent",no_focus=true,suppress_event="activate activatefocus"})'
  trap 'hyprctl eval '\''hl.window_rule({name="chatgpt-startup",enabled=false})'\''' EXIT
  hyprctl dispatch 'hl.dsp.exec_cmd("exec env CODEX_ELECTRON_START_IN_BACKGROUND=1 /usr/bin/chatgpt")'

  # Closing the initial window leaves ChatGPT running in its tray.
  for (( attempt = 0; attempt < 300; attempt++ )); do
    window=$(hyprctl -j clients | jq -r '
      [.[] | select(.class == "chatgpt" and .mapped and (.floating | not)
        and .workspace.name == "special:chatgpt-startup")]
      | .[0].address // empty
    ')
    tray_service=$(busctl --user --no-legend list | awk '
      $3 == "ChatGPT" && $1 ~ /^org\.freedesktop\.StatusNotifierItem-/ { print $1 }
    ')
    if [[ -n "${window}" && -n "${tray_service}" ]]; then
      hyprctl dispatch "hl.dsp.window.close({window=\"address:${window}\"})"
      exit 0
    fi
    sleep 0.1
  done

  printf 'ChatGPT did not initialize its window and tray within 30 seconds.\n' >&2
  exit 1
fi

# Files and deep links need ChatGPT's normal argument handling.
if (( $# > 0 )); then
  exec /usr/bin/chatgpt "$@"
fi

workspace=$(hyprctl -j activeworkspace | jq -er '.id')

find_window() {
  hyprctl -j clients | jq -r --argjson workspace "${workspace}" '
    [.[] | select(.class == "chatgpt" and .mapped and (.floating | not))]
    | sort_by([(.workspace.id != $workspace), .focusHistoryID])
    | .[0].address // empty
  '
}

open_chat() {
  hyprctl dispatch "hl.dsp.window.move({window=\"address:${window}\",workspace=${workspace},follow=false})"
  hyprctl dispatch "hl.dsp.focus({window=\"address:${window}\"})"
  # ChatGPT's New standalone chat command, outside the selected project.
  hyprctl dispatch "hl.dsp.send_shortcut({window=\"address:${window}\",mods=\"CTRL ALT\",key=\"o\"})"
}

window=$(find_window)
if [[ -n "${window}" ]]; then
  open_chat
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
    open_chat
    exit 0
  fi
  sleep 0.1
done

printf 'ChatGPT did not open a main window within 15 seconds.\n' >&2
exit 1
