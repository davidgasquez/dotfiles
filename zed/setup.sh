#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
ZED_CONFIG_DIR="${HOME}/.config/zed"
ZED_THEMES_DIR="${ZED_CONFIG_DIR}/themes"

paru -S --needed --noconfirm zed

mkdir -p "${ZED_CONFIG_DIR}" "${ZED_THEMES_DIR}"

ln -snf "${DOTFILES}/zed/settings.json" "${ZED_CONFIG_DIR}/settings.json"
ln -snf "${DOTFILES}/zed/keymap.json" "${ZED_CONFIG_DIR}/keymap.json"
ln -snf "${DOTFILES}/zed/tasks.json" "${ZED_CONFIG_DIR}/tasks.json"
ln -snf "${DOTFILES}/zed/theme-catppuccin-blue.json" "${ZED_THEMES_DIR}/theme-catppuccin-blue.json"
