#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
HYPR_CONFIG_DIR="${HOME}/.config/hypr"
WAYBAR_CONFIG_DIR="${HOME}/.config/waybar"
MAKO_CONFIG_DIR="${HOME}/.config/mako"
FUZZEL_CONFIG_DIR="${HOME}/.config/fuzzel"
PICTURES_DIR="${HOME}/Pictures"

packages=(
    bemoji
    cliphist
    fuzzel
    hypridle
    hyprland
    hyprland-guiutils
    hyprlock
    hyprpaper
    hyprpolkitagent
    hyprshot
    mako
    pavucontrol
    pipewire
    pipewire-alsa
    pipewire-pulse
    pipewire-libcamera
    playerctl
    waybar
    wireplumber
    wl-clip-persist
    wl-clipboard
    xdg-desktop-portal-gtk
    xdg-desktop-portal-hyprland
    xdg-utils
    uwsm
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Start Polkit agent for Hyprland (https://wiki.hypr.land/Hypr-Ecosystem/hyprpolkitagent/)
if ! systemctl --user is-active --quiet hyprpolkitagent.service; then
    systemctl --user enable --now hyprpolkitagent.service
fi

mkdir -p "${HYPR_CONFIG_DIR}" "${WAYBAR_CONFIG_DIR}" "${MAKO_CONFIG_DIR}" "${FUZZEL_CONFIG_DIR}" "${PICTURES_DIR}"

ln -sf "${DOTFILES}/hypr/wallpaper.png" "${PICTURES_DIR}/wallpaper.png"
ln -sf "${DOTFILES}/hypr/frappe.conf" "${HYPR_CONFIG_DIR}/frappe.conf"
ln -sf "${DOTFILES}/hypr/hyprland.conf" "${HYPR_CONFIG_DIR}/hyprland.conf"
ln -sf "${DOTFILES}/hypr/hyprpaper.conf" "${HYPR_CONFIG_DIR}/hyprpaper.conf"
ln -sf "${DOTFILES}/hypr/hypridle.conf" "${HYPR_CONFIG_DIR}/hypridle.conf"
ln -sf "${DOTFILES}/hypr/hyprlock.conf" "${HYPR_CONFIG_DIR}/hyprlock.conf"
ln -sf "${DOTFILES}/hypr/xdph.conf" "${HYPR_CONFIG_DIR}/xdph.conf"
ln -sf "${DOTFILES}/hypr/waybar/config.jsonc" "${WAYBAR_CONFIG_DIR}/config"
ln -sf "${DOTFILES}/hypr/waybar/style.css" "${WAYBAR_CONFIG_DIR}/style.css"
ln -sf "${DOTFILES}/hypr/waybar/frappe.css" "${WAYBAR_CONFIG_DIR}/frappe.css"
ln -sf "${DOTFILES}/hypr/mako/config" "${MAKO_CONFIG_DIR}/config"
ln -sf "${DOTFILES}/hypr/fuzzel/fuzzel.ini" "${FUZZEL_CONFIG_DIR}/fuzzel.ini"
