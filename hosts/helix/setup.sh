#!/usr/bin/env bash
set -euo pipefail

HOST_DIR=$(dirname "$(realpath "$0")")
HYPR_CONFIG_DIR="${HOME}/.config/hypr"

echo "Installing llama.cpp and whisper.cpp ..."
paru -S --noconfirm llama.cpp-hip whisper.cpp-hip
echo "Installed."

mkdir -p "${HYPR_CONFIG_DIR}"
ln -sf "${HOST_DIR}/hypr/monitor.conf" "${HYPR_CONFIG_DIR}/monitor.conf"

echo "Configure solaar (https://wiki.archlinux.org/title/Logitech_Unifying_Receiver)"
