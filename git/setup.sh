#!/usr/bin/env bash
set -euo pipefail

packages=(
    git
    git-lfs
    github-cli
)

# Install packages
paru -S --needed --noconfirm "${packages[@]}"

# Create symlinks for git configuration
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
ln -sfnT "${SCRIPT_DIR}/gitconfig" "${HOME}/.gitconfig"
ln -sfnT "${SCRIPT_DIR}/.gitignore_global" "${HOME}/.gitignore_global"

# Configure Git LFS filters globally
git lfs install --skip-repo
