#!/usr/bin/env bash

packages=(
    alacritty
    aria2
    bat
    btop
    eza
    fzf
    htop
    jq
    nvtop
    ripgrep
    ripgrep
    starship
    wget
    yt-dlp
    zoxide
)

paru -S --needed --noconfirm "${packages[@]}"
