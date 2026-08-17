#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")

packages=(
    bind
    blueman
    btrfs-progs
    bluez
    bluez-utils
    ccache
    tailscale
    docker
    docker-buildx
    docker-compose
    dosfstools
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
    rocm-smi-lib
    sox
    ufw
    unzip
    util-linux
    wireless-regdb
    xdg-user-dirs
    zram-generator
)

# Install system packages
paru -S --needed --noconfirm "${packages[@]}"

# Compressed swap
sudo install -Dm644 "${DOTFILES}/system/zram-generator.conf" /etc/systemd/zram-generator.conf
sudo install -Dm644 "${DOTFILES}/system/disable-zswap.conf" /etc/tmpfiles.d/disable-zswap.conf
sudo systemd-tmpfiles --create --boot /etc/tmpfiles.d/disable-zswap.conf

# Network Manager
sudo systemctl enable --now NetworkManager.service

# Firewall
sudo systemctl enable --now ufw
sudo ufw --force enable

# SSD Trim
sudo systemctl enable --now fstrim.timer

# Out-of-memory daemon
sudo install -Dm644 "${DOTFILES}/system/oomd-pressure.conf" /etc/systemd/system/system.slice.d/60-oomd-pressure.conf
sudo install -Dm644 "${DOTFILES}/system/oomd-pressure.conf" /etc/systemd/user/app.slice.d/60-oomd-pressure.conf
sudo systemctl daemon-reload
systemctl --user daemon-reload
sudo systemctl enable --now systemd-oomd.service

# Power Profiles
sudo systemctl enable --now power-profiles-daemon.service

# Gnome Keyring
systemctl --user enable --now gnome-keyring-daemon.service

# Bluetooth
sudo systemctl enable --now bluetooth.service

# Package cache cleanup
sudo systemctl enable --now paccache.timer

# Btrfs integrity checking
if [[ "$(findmnt -no FSTYPE /)" == "btrfs" ]]; then
    sudo systemctl enable --now btrfs-scrub@-.timer
fi

# Start Docker on demand
sudo systemctl enable --now docker.socket
if systemctl is-enabled --quiet docker.service; then
    sudo systemctl disable docker.service
fi
if ! groups "$USER" | grep -q "\bdocker\b"; then
    sudo usermod -aG docker "$USER"
fi

# Tailscale
sudo systemctl enable --now tailscaled
if ! tailscale status &>/dev/null; then
    tailscale up
fi
