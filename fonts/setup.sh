#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
FONTCONFIG_DIR="${HOME}/.config/fontconfig"

packages=(
    fontconfig
    inter-font
    noto-fonts
    noto-fonts-cjk
    noto-fonts-emoji
    noto-fonts-extra
    otf-font-awesome
    ttf-croscore
    ttf-dejavu
    ttf-droid
    ttf-jetbrains-mono-nerd
    ttf-liberation
    ttf-mac-fonts
    ttf-ms-fonts
    ttf-roboto
    ttf-ubuntu-font-family
)

paru -S --needed --noconfirm "${packages[@]}"

mkdir -p "${FONTCONFIG_DIR}"
ln -snf "${DOTFILES}/fonts/fontconfig/fonts.conf" "${FONTCONFIG_DIR}/fonts.conf"

fc-cache -f
