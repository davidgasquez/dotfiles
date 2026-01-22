#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")

packages=(
    alacritty
    aria2
    bash-completion
    bat
    btop
    eza
    ffmpeg
    fzf
    htop
    jq
    nvtop
    prek-bin
    ripgrep
    sheldon
    shellcheck-bin
    starship
    tmux
    uv
    npm
    wget
    zoxide
    zsh
)

# Install packages
paru -S --needed --noconfirm "${packages[@]}"

# Install yt-dlp
uv tool install --reinstall yt-dlp --with secretstorage

# Create directories
mkdir -p "${HOME}/.config/alacritty" "${HOME}/.config/sheldon" "${HOME}/.config/starship"

# Create symlinks
ln -sf "${DOTFILES}/terminal/alacritty.toml" "${HOME}/.config/alacritty/alacritty.toml"
ln -sf "${DOTFILES}/terminal/bashrc" "${HOME}/.bashrc"
ln -sf "${DOTFILES}/terminal/zshrc" "${HOME}/.zshrc"
ln -sf "${DOTFILES}/terminal/sheldon/plugins.toml" "${HOME}/.config/sheldon/plugins.toml"
ln -sf "${DOTFILES}/terminal/inputrc" "${HOME}/.inputrc"
ln -sf "${DOTFILES}/terminal/starship.toml" "${HOME}/.config/starship.toml"

# Optional: ble.sh configuration (link if present)
if [[ -f "${DOTFILES}/terminal/blerc.sh" ]]; then
    ln -sf "${DOTFILES}/terminal/blerc.sh" "${HOME}/.blerc"
fi
