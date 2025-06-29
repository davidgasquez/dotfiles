#!/usr/bin/env bash

packages=(
    git
    github-cli
)

# Install packages
paru -S --needed --noconfirm "${packages[@]}"
