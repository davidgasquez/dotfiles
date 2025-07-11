#!/usr/bin/env bash

packages=(
    cloudflare-warp-bin
    fwupd
    mkinitcpio-firmware
    networkmanager
    network-manager-applet
    power-profiles-daemon
    preload
    ufw
    util-linux
    rocm-smi-lib
    docker
    docker-buildx
    gnome-keyring
    xdg-user-dirs
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Network Manager
if ! systemctl is-enabled --quiet NetworkManager.service; then
    systemctl enable --now NetworkManager.service
fi

# Firewall
if ! systemctl is-enabled --quiet ufw; then
    systemctl enable --now ufw
    sudo ufw enable
fi

# SSD Trim
if ! systemctl is-enabled --quiet fstrim.timer; then
    systemctl enable --now fstrim.timer
fi

# Preload
if ! systemctl is-enabled --quiet preload; then
    systemctl enable --now preload
fi

# Gnome Keyring
if ! systemctl --user is-enabled --quiet gnome-keyring-daemon.socket; then
    systemctl --user enable --now gnome-keyring-daemon.socket
fi

# Docker
if ! systemctl is-enabled --quiet docker.service; then
    systemctl enable --now docker

    # Add user to docker group
    if ! groups "$USER" | grep -q "\bdocker\b"; then
        sudo usermod -aG docker "$USER"
    fi
fi

# Enable WARP
if ! systemctl is-enabled --quiet warp-svc; then
    sudo systemctl enable --now warp-svc
fi

# Register WARP if not already registered
if ! warp-cli registration show &>/dev/null; then
    warp-cli registration new # Needs manual intervention, check help and see if it can be forced
fi

# Connect WARP if not already connected
if ! warp-cli status | grep -q "Status update: Connected"; then
    warp-cli connect
fi
