#!/usr/bin/env bash
set -euo pipefail

packages=(
    llama.cpp-hip
)

echo "Installing llama packages..."
paru -S --needed --noconfirm "${packages[@]}"
