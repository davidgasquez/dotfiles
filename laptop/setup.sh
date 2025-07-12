#!/usr/bin/env bash

packages=(
    brightnessctl
    powertop
    power-profiles-daemon
    plymouth
    python-gobject # Required for power-profiles-daemon
)

# Keyboard
brightnessctl --device=asus::kbd_backlight set 3

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Power Profiles Daemon
if ! systemctl is-enabled --quiet power-profiles-daemon; then
    systemctl enable --now power-profiles-daemon
fi

# PowerTOP
DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
sudo cp "${DOTFILES}"/laptop/powertop.service /etc/systemd/system/powertop.service
if ! systemctl is-enabled --quiet powertop.service; then
    systemctl enable --now powertop.service
fi
