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
    uwsm
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Start Polkit agent for Hyprland (https://wiki.hypr.land/Hypr-Ecosystem/hyprpolkitagent/)
if ! systemctl --user is-active --quiet hyprpolkitagent.service; then
    systemctl --user enable --now hyprpolkitagent.service
fi
