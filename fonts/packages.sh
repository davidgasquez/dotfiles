#!/usr/bin/env bash
set -euo pipefail

packages=(
    inter-font
    noto-fonts
    noto-fonts-cjk
    noto-fonts-emoji
    noto-fonts-extra
    otf-font-awesome
    ttf-croscore
    ttf-dejavu
    ttf-droid
    ttf-jetbrains-mono-nerd
    ttf-liberation
    ttf-mac-fonts
    ttf-ms-fonts
    ttf-roboto
    ttf-ubuntu-font-family
)

paru -S --needed --noconfirm "${packages[@]}"
