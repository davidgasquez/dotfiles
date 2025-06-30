#!/usr/bin/env bash

packages=(
    ufw
    reflector
    util-linux
    preload
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Firewall
if ! systemctl is-enabled --quiet ufw; then
    systemctl enable --now ufw
    sudo ufw enable
fi

# Reflector
if ! systemctl is-enabled --quiet reflector; then
    systemctl enable --now reflector.service
fi

# SSD Trim
if ! systemctl is-enabled --quiet fstrim.timer; then
    systemctl enable --now fstrim.timer
fi

# Preload
if ! systemctl is-enabled --quiet preload; then
    systemctl enable --now preload
fi
