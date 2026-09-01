#!/usr/bin/env bash
set -euo pipefail

packages=(
    ggml
    ggml-hip
    llama-cpp
)

echo "Installing llama packages..."
paru -S --needed --noconfirm "${packages[@]}"
