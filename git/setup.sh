#!/usr/bin/env bash

packages=(
    git
    github-cli
)

# Install packages
paru -S --needed --noconfirm "${packages[@]}"

# Create symlinks for git configuration
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
ln -snf "${SCRIPT_DIR}/gitconfig" "${HOME}/.gitconfig"
ln -snf "${SCRIPT_DIR}/.gitignore_global" "${HOME}/.gitignore_global"
