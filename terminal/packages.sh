#!/usr/bin/env bash

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
    ripgrep
    starship
    uv
    wget
    yt-dlp
    zoxide
)

llm_plugins=(
    llm-anthropic
    llm-cmd
    llm-fragments-github
    llm-fragments-reader
    llm-fragments-youtube
    llm-gemini
    llm-github-copilot
    llm-openai-plugin
)

# Install packages
paru -S --needed --noconfirm "${packages[@]}"

# Install llm with plugins
llm_with_args=()
for plugin in "${llm_plugins[@]}"; do
    llm_with_args+=("--with" "$plugin")
done
uv tool install --reinstall -U llm "${llm_with_args[@]}"

# Create directories
mkdir -p "${HOME}/.config/alacritty" "${HOME}/.config/io.datasette.llm" "${HOME}/.config/sheldon" "${HOME}/.config/starship"

# Create symlinks
ln -sf "${DOTFILES}/terminal/alacritty.toml" "${HOME}/.config/alacritty/alacritty.toml"
ln -sf "${DOTFILES}/terminal/bashrc" "${HOME}/.bashrc"
ln -sf "${DOTFILES}/terminal/zshrc" "${HOME}/.zshrc"
ln -sf "${DOTFILES}/terminal/sheldon/plugins.toml" "${HOME}/.config/sheldon/plugins.toml"
ln -sf "${DOTFILES}/terminal/blerc.sh" "${HOME}/.blerc"
ln -sf "${DOTFILES}/terminal/inputrc" "${HOME}/.inputrc"
ln -sf "${DOTFILES}/terminal/starship.toml" "${HOME}/.config/starship.toml"
ln -sfT "${DOTFILES}/llm" "${HOME}/.config/io.datasette.llm/templates"
