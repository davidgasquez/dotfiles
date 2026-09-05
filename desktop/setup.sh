#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")

ICON_THEME="Papirus-Dark"
CURSOR_THEME="catppuccin-frappe-light-cursors"
CURSOR_SIZE="24"
FONT_NAME="Inter Display 11"

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

mkdir -p "${HOME}/.config"
ln -sfnT "${DOTFILES}/desktop/brave-flags.conf" "${HOME}/.config/brave-flags.conf"

gsettings set org.gnome.desktop.interface icon-theme "${ICON_THEME}"
gsettings set org.gnome.desktop.interface cursor-theme "${CURSOR_THEME}"
gsettings set org.gnome.desktop.interface cursor-size "${CURSOR_SIZE}"
gsettings set org.gnome.desktop.interface font-name "${FONT_NAME}"
