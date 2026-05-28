#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
MANGOHUD_CONFIG_DIR="${HOME}/.config/MangoHud"

packages=(
    steam
    steam-devices
    mesa
    vulkan-radeon
    lib32-mesa
    lib32-vulkan-radeon
    lib32-vulkan-icd-loader
    lib32-pipewire
    lib32-alsa-plugins
    lib32-libpulse
    gamemode
    lib32-gamemode
    gamescope
    mangohud
    lib32-mangohud
)

if ! grep -Eq '^\[multilib\]' /etc/pacman.conf; then
    echo "error: pacman multilib repository is not enabled" >&2
    echo "enable [multilib], run sudo pacman -Syu, then rerun this script" >&2
    exit 1
fi

paru -S --needed --noconfirm "${packages[@]}"

mkdir -p "${MANGOHUD_CONFIG_DIR}"
ln -sf "${DOTFILES}/steam/MangoHud.conf" "${MANGOHUD_CONFIG_DIR}/MangoHud.conf"

if ! getent group gamemode >/dev/null; then
    echo "error: gamemode group does not exist after installing gamemode" >&2
    exit 1
fi

if ! id -nG "$USER" | grep -qw gamemode; then
    sudo usermod -aG gamemode "$USER"
    echo "Added $USER to gamemode group. Log out and back in before relying on GameMode."
fi

printf 'Steam gaming setup is installed.\n'
