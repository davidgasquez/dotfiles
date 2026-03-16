#!/usr/bin/env bash
set -euo pipefail

if pacman -Qq llama.cpp >/dev/null 2>&1; then
    echo "Replacing llama.cpp with llama.cpp-hip..."
    paru -Rns --noconfirm llama.cpp
fi

echo "Installing llama.cpp-hip..."
paru -S --needed --noconfirm llama.cpp-hip

echo "llama.cpp-hip installed."

echo "Configure solaar (https://wiki.archlinux.org/title/Logitech_Unifying_Receiver)"
