#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")

packages=(
    ghostty
    aria2
    bash-completion
    bat
    btop
    bun
    chafa
    duckdb
    eza
    ffmpeg
    fzf
    htop
    jq
    nvtop
    poppler
    prek-bin
    ripgrep
    shellcheck
    starship
    tmux
    uv
    npm
    wget
    zoxide
    zsh
    zsh-autosuggestions
    zsh-history-substring-search
    zsh-syntax-highlighting
    yt-dlp
)

# Install packages
paru -S --needed --noconfirm "${packages[@]}"

# Install uv tools
if ! command -v markitdown >/dev/null; then
    uv tool install 'markitdown[pdf, youtube-transcription]'
fi

# Create directories
mkdir -p \
    "${HOME}/.config/ghostty" \
    "${XDG_CACHE_HOME:-${HOME}/.cache}/zsh/completions"

# Create symlinks
ln -sfnT "${DOTFILES}/terminal/ghostty/config" "${HOME}/.config/ghostty/config"
ln -sfnT "${DOTFILES}/terminal/bashrc" "${HOME}/.bashrc"
ln -sfnT "${DOTFILES}/terminal/zshrc" "${HOME}/.zshrc"
ln -sfnT "${DOTFILES}/terminal/zprofile" "${HOME}/.zprofile"
ln -sfnT "${DOTFILES}/terminal/inputrc" "${HOME}/.inputrc"
ln -sfnT "${DOTFILES}/terminal/starship.toml" "${HOME}/.config/starship.toml"

systemctl --user enable --now app-com.mitchellh.ghostty.service
