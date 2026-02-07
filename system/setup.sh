#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")

packages=(
    bind
    blueman
    bluez
    cloudflare-warp-bin
    tailscale
    docker
    docker-buildx
    fwupd
    gnome-keyring
    less
    mkinitcpio-firmware
    network-manager-applet
    networkmanager
    pacman-contrib
    power-profiles-daemon
    rocm-smi-lib
    sox
    ufw
    util-linux
    xdg-user-dirs
)

# Install system packages
paru -S --needed --noconfirm "${packages[@]}"

sudo rm -f /etc/sysctl.d/99-swappiness.conf
sudo cp "${DOTFILES}/system/99-swappiness.conf" /etc/sysctl.d/99-swappiness.conf

tmpfs_entry='tmpfs   /tmp    tmpfs   defaults,noatime,mode=1777,size=2G   0  0'
if ! grep -Eq '^\s*tmpfs\s+/tmp\s+tmpfs\b' /etc/fstab; then
    echo "$tmpfs_entry" | sudo tee -a /etc/fstab >/dev/null
fi

# Network Manager
if ! systemctl is-enabled --quiet NetworkManager.service; then
    sudo systemctl enable --now NetworkManager.service
fi

# Firewall
if ! systemctl is-enabled --quiet ufw; then
    sudo systemctl enable --now ufw
    sudo ufw enable
fi

# SSD Trim
if ! systemctl is-enabled --quiet fstrim.timer; then
    sudo systemctl enable --now fstrim.timer
fi

# Out-of-memory daemon
if ! systemctl is-enabled --quiet systemd-oomd.service; then
    sudo systemctl enable --now systemd-oomd.service
fi

# Gnome Keyring
if ! systemctl --user is-enabled --quiet gnome-keyring-daemon.socket; then
    systemctl --user enable --now gnome-keyring-daemon.socket
fi

# Docker
if ! systemctl is-enabled --quiet docker.service; then
    sudo systemctl enable --now docker

    # Add user to docker group
    if ! groups "$USER" | grep -q "\bdocker\b"; then
        sudo usermod -aG docker "$USER"
    fi
fi

# Tailscale
if ! systemctl is-enabled --quiet tailscaled; then
    sudo systemctl enable --now tailscaled
fi
if ! tailscale status &>/dev/null; then
    tailscale up
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
