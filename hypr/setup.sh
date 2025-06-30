#!/usr/bin/env bash

packages=(
    bemoji
    cliphist
    fuzzel
    hypridle
    hyprland
    hyprland-qtutils
    hyprlock
    hyprpaper
    hyprpolkitagent
    hyprshot
    mako
    pavucontrol
    pipewire
    pipewire-alsa
    pipewire-pulse
    playerctl
    waybar
    wireplumber
    wl-clip-persist
    wl-clipboard
    xdg-desktop-portal-gtk
    xdg-desktop-portal-hyprland
    xdg-utils
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Start Polkit agent for Hyprland (https://wiki.hypr.land/Hypr-Ecosystem/hyprpolkitagent/)
systemctl --user enable --now hyprpolkitagent.service
