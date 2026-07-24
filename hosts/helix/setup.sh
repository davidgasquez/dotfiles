#!/usr/bin/env bash
set -euo pipefail

HOST_DIR=$(dirname "$(realpath "$0")")
HYPR_CONFIG_DIR="${HOME}/.config/hypr"
PIPEWIRE_CONFIG_DIR="${HOME}/.config/pipewire/pipewire.conf.d"

packages=(
    libratbag
    piper
    whisper-cpp
)

echo "Installing Helix packages..."
paru -S --needed --noconfirm "${packages[@]}"

echo "Enabling ratbagd for Piper mouse DPI configuration..."
sudo systemctl enable --now ratbagd.service

mkdir -p "${HYPR_CONFIG_DIR}" "${PIPEWIRE_CONFIG_DIR}"
ln -sf "${HOST_DIR}/hypr/monitor.conf" "${HYPR_CONFIG_DIR}/monitor.conf"
ln -sf "${HOST_DIR}/pipewire/pipewire.conf.d/20-office-output-notch-128hz.conf" "${PIPEWIRE_CONFIG_DIR}/20-office-output-notch-128hz.conf"

echo "Restart PipeWire to apply the output notch:"
echo "  systemctl --user restart pipewire pipewire-pulse wireplumber"

echo "Configure solaar (https://wiki.archlinux.org/title/Logitech_Unifying_Receiver)"
