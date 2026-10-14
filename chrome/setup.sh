#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
CONFIG_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}"
SYSTEMD_USER_DIR="${CONFIG_DIR}/systemd/user"

paru -S --needed --noconfirm google-chrome

mkdir -p "${CONFIG_DIR}/chrome" "${SYSTEMD_USER_DIR}"
ln -sfnT "${DOTFILES}/chrome/extension" "${CONFIG_DIR}/chrome/extension"
ln -sfnT "${DOTFILES}/chrome/theme" "${CONFIG_DIR}/chrome/theme"
ln -sfnT "${DOTFILES}/chrome/chrome-background.service" "${SYSTEMD_USER_DIR}/chrome-background.service"

systemctl --user daemon-reload
# Start after the extension is installed; without it Chrome exits immediately.
systemctl --user enable chrome-background.service

printf '\nLoad unpacked extension in chrome://extensions/: %s\n' "${CONFIG_DIR}/chrome/extension"
printf 'Load unpacked theme to match Brave: %s\n' "${CONFIG_DIR}/chrome/theme"
printf '%s\n' \
    'Enable "Continue running background apps when Google Chrome is closed" in chrome://settings/system.' \
    'Then run: systemctl --user start chrome-background.service'
