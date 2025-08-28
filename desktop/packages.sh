#!/usr/bin/env bash
set -euo pipefail

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
