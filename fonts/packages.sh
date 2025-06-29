#!/usr/bin/env bash

packages=(
    noto-fonts
    noto-fonts-cjk
    noto-fonts-emoji
    noto-fonts-extra
    ttf-mac-fonts
    ttf-ms-fonts
    ttf-croscore
    ttf-dejavu
    ttf-droid
    ttf-jetbrains-mono-nerd
    ttf-liberation
    ttf-roboto
    ttf-ubuntu-font-family
)

paru -S --needed --noconfirm "${packages[@]}"
