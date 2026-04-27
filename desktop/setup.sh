#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
CONFIG_DIR="${HOME}/.config"
ICONS_DEFAULT_DIR="${HOME}/.icons/default"
CURSOR_THEME="catppuccin-frappe-light-cursors"
CURSOR_SIZE="24"

packages=(
    brave-bin
    file-roller
    gvfs
    gvfs-mtp
    mpv
    ntfs-3g
    slack-desktop
    spotify
    thunar
    tumbler
    thunar-archive-plugin
    catppuccin-cursors-frappe
    catppuccin-gtk-theme-frappe
    papirus-icon-theme
    nwg-look
)

paru -S --needed --noconfirm "${packages[@]}"

gsettings set org.gnome.desktop.interface cursor-theme "${CURSOR_THEME}"
gsettings set org.gnome.desktop.interface cursor-size "${CURSOR_SIZE}"

mkdir -p "${CONFIG_DIR}" "${ICONS_DEFAULT_DIR}"

ln -sf "${DOTFILES}/desktop/icons/default/index.theme" "${ICONS_DEFAULT_DIR}/index.theme"
ln -sf "${DOTFILES}/desktop/brave-flags.conf" "${CONFIG_DIR}/brave-flags.conf"
ln -sf "${DOTFILES}/desktop/electron-flags.conf" "${CONFIG_DIR}/electron-flags.conf"
