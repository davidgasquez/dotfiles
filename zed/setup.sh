#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
ZED_CONFIG_DIR="${HOME}/.config/zed"
ZED_THEMES_DIR="${ZED_CONFIG_DIR}/themes"
THEME_URL="https://github.com/catppuccin/zed/releases/download/v0.2.25/catppuccin-blue.json"
THEME_SOURCE_PATH="${DOTFILES}/zed/theme-catppuccin-blue.json"

if ! pacman -Q zed >/dev/null 2>&1; then
    paru -S --noconfirm zed
fi

curl -L --fail --silent --show-error "${THEME_URL}" -o "${THEME_SOURCE_PATH}"

mkdir -p "${ZED_CONFIG_DIR}" "${ZED_THEMES_DIR}"

ln -snf "${DOTFILES}/zed/settings.json" "${ZED_CONFIG_DIR}/settings.json"
ln -snf "${DOTFILES}/zed/keymap.json" "${ZED_CONFIG_DIR}/keymap.json"
ln -snf "${DOTFILES}/zed/tasks.json" "${ZED_CONFIG_DIR}/tasks.json"
ln -snf "${THEME_SOURCE_PATH}" "${ZED_THEMES_DIR}/theme-catppuccin-blue.json"
