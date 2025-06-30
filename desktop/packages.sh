#!/usr/bin/env bash

packages=(
    brave-bin
    espanso
    file-roller
    gvfs
    gvfs-mtp
    mpv
    ntfs-3g
    thunar
    tumbler
    thunar-archive-plugin
)

paru -S --needed --noconfirm "${packages[@]}"
