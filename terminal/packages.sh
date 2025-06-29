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
    ffmpeg
    zoxide
    bash-completion
)

# Install packages
paru -S --needed --noconfirm "${packages[@]}"
