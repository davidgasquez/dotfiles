#!/usr/bin/env bash

# TODO Add G14 repository
echo TODO
echo "https://asus-linux.org/guides/arch-guide"

packages=(
    brightnessctl
    powertop
    power-profiles-daemon
    plymouth
    python-gobject # Required for power-profiles-daemon
    asusctl
    supergfxctl
    rog-control-center
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Keyboard
brightnessctl --device=asus::kbd_backlight set 3

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
