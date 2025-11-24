#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
CODE_CONFIG_DIR="${HOME}/.config/Code/User"
CODE_FLAGS_PATH="${HOME}/.config/code-flags.conf"

paru -S --needed --noconfirm visual-studio-code-bin

mkdir -p "${CODE_CONFIG_DIR}"

ln -snf "${DOTFILES}/code/settings.json" "${CODE_CONFIG_DIR}/settings.json"
ln -snf "${DOTFILES}/code/keybindings.json" "${CODE_CONFIG_DIR}/keybindings.json"
ln -snf "${DOTFILES}/code/tasks.json" "${CODE_CONFIG_DIR}/tasks.json"
ln -snf "${DOTFILES}/code/code-flags.conf" "${CODE_FLAGS_PATH}"
