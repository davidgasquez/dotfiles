#!/usr/bin/env bash

packages=(
    hyprland
    bemoji
    fuzzel
    waybar
    mako
    hyprshot
    hyprlock
    hypridle
    hyprpolkitagent
    hyprland-qtutils
    wl-clipboard
    xdg-desktop-portal-hyprland
    xdg-desktop-portal-gtk
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Start Polkit agent for Hyprland
systemctl --user enable --now hyprpolkitagent.service
