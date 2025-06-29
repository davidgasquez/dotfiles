#!/usr/bin/env bash

packages=(
    catppuccin-gtk-theme-frappe
    papirus-icon-theme
    nwg-look
)

paru -S --needed --noconfirm "${packages[@]}"
