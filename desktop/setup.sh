#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
CONFIG_DIR="${HOME}/.config"

packages=(
    brave-bin
    file-roller
    gvfs
    gvfs-mtp
    mpv
    ntfs-3g
    thunar
    tumbler
    thunar-archive-plugin
    catppuccin-gtk-theme-frappe
    papirus-icon-theme
    nwg-look
)

paru -S --needed --noconfirm "${packages[@]}"

mkdir -p "${CONFIG_DIR}"

ln -sf "${DOTFILES}/desktop/brave-flags.conf" "${CONFIG_DIR}/brave-flags.conf"
ln -sf "${DOTFILES}/desktop/electron-flags.conf" "${CONFIG_DIR}/electron-flags.conf"
