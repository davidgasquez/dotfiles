#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")

packages=(
    bind
    blueman
    bluez
    ccache
    tailscale
    docker
    docker-buildx
    docker-compose
    fwupd
    gnome-keyring
    inetutils
    less
    libnotify
    mkinitcpio-firmware
    network-manager-applet
    networkmanager
    pacman-contrib
    power-profiles-daemon
    rclone
    rocm-smi-lib
    sox
    ufw
    unzip
    util-linux
    xdg-user-dirs
    zram-generator
)

# Install system packages
paru -S --needed --noconfirm "${packages[@]}"

sudo rm -f /etc/sysctl.d/99-swappiness.conf
sudo cp "${DOTFILES}/system/99-swappiness.conf" /etc/sysctl.d/99-swappiness.conf
sudo install -Dm644 "${DOTFILES}/system/zram-generator.conf" /etc/systemd/zram-generator.conf

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

# Power Profiles
if ! systemctl is-enabled --quiet power-profiles-daemon.service; then
    sudo systemctl enable --now power-profiles-daemon.service
fi

# Gnome Keyring
if ! systemctl --user is-enabled --quiet gnome-keyring-daemon.socket; then
    systemctl --user enable --now gnome-keyring-daemon.socket
fi

# Start Dockler on demand
if ! systemctl is-enabled --quiet docker.socket; then
    sudo systemctl enable --now docker.socket
fi
if systemctl is-enabled --quiet docker.service; then
    sudo systemctl disable docker.service
fi
if ! groups "$USER" | grep -q "\bdocker\b"; then
    sudo usermod -aG docker "$USER"
fi

# Tailscale
if ! systemctl is-enabled --quiet tailscaled; then
    sudo systemctl enable --now tailscaled
fi
if ! tailscale status &>/dev/null; then
    tailscale up
fi
