#!/usr/bin/env bash
set -euo pipefail

HOST_DIR=$(dirname "$(realpath "$0")")
HYPR_CONFIG_DIR="${HOME}/.config/hypr"

echo "Installing llama.cpp-hip..."
paru -S --needed --noconfirm llama.cpp-hip

echo "llama.cpp-hip installed."

mkdir -p "${HYPR_CONFIG_DIR}"
ln -sf "${HOST_DIR}/hypr/monitor.conf" "${HYPR_CONFIG_DIR}/monitor.conf"

echo "Configure solaar (https://wiki.archlinux.org/title/Logitech_Unifying_Receiver)"
