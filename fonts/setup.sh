#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
FONTCONFIG_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/fontconfig"

packages=(
    fontconfig
    inter-font
    noto-fonts
    noto-fonts-cjk
    noto-fonts-emoji
    ttf-jetbrains-mono
    ttf-liberation
    ttf-nerd-fonts-symbols
)

paru -S --needed --noconfirm "${packages[@]}"

mkdir -p "${FONTCONFIG_DIR}"
ln -snf "${DOTFILES}/fonts/fontconfig/fonts.conf" "${FONTCONFIG_DIR}/fonts.conf"
