#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
HYPR_CONFIG_DIR="${HOME}/.config/hypr"
WAYBAR_CONFIG_DIR="${HOME}/.config/waybar"
MAKO_CONFIG_DIR="${HOME}/.config/mako"
FUZZEL_CONFIG_DIR="${HOME}/.config/fuzzel"
VOXTYPE_CONFIG_DIR="${HOME}/.config/voxtype"
FCITX_CONFIG_DIR="${HOME}/.config/fcitx5"
UWSM_CONFIG_DIR="${HOME}/.config/uwsm"
CLIPHIST_CONFIG_DIR="${HOME}/.config/cliphist"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"
PICTURES_DIR="${HOME}/Pictures"

packages=(
    bemoji
    brightnessctl
    cliphist
    fcitx5
    fcitx5-gtk
    fuzzel
    hypridle
    hyprland
    hyprland-guiutils
    hyprlock
    hyprpaper
    hyprpolkitagent
    hyprshot
    libnewt
    mako
    pavucontrol
    pipewire
    pipewire-alsa
    pipewire-libcamera
    pipewire-pulse
    playerctl
    uwsm
    voxtype-bin
    vulkan-icd-loader
    vulkan-radeon
    waybar
    wireplumber
    wl-clipboard
    wtype
    xdg-desktop-portal-gtk
    xdg-desktop-portal-hyprland
    xdg-utils
)

# Install Hyprland and related packages
paru -S --needed --noconfirm "${packages[@]}"

# Start Hyprland session services.
services=(
    cliphist-image.service
    cliphist-text.service
    hypridle.service
    hyprpaper.service
    hyprpolkitagent.service
    mako.service
    voxtype.service
    waybar.service
)

mkdir -p "${HYPR_CONFIG_DIR}" "${WAYBAR_CONFIG_DIR}" "${MAKO_CONFIG_DIR}" "${FUZZEL_CONFIG_DIR}" "${VOXTYPE_CONFIG_DIR}" "${FCITX_CONFIG_DIR}" "${UWSM_CONFIG_DIR}" "${CLIPHIST_CONFIG_DIR}" "${SYSTEMD_USER_DIR}" "${PICTURES_DIR}"

ln -sf "${DOTFILES}/hypr/wallpaper.png" "${PICTURES_DIR}/wallpaper.png"
ln -sf "${DOTFILES}/hypr/frappe.conf" "${HYPR_CONFIG_DIR}/frappe.conf"
ln -sf "${DOTFILES}/.luarc.json" "${HYPR_CONFIG_DIR}/.luarc.json"
ln -sf "${DOTFILES}/hypr/hyprland.lua" "${HYPR_CONFIG_DIR}/hyprland.lua"
ln -sf "${DOTFILES}/hypr/autostart.lua" "${HYPR_CONFIG_DIR}/autostart.lua"
ln -sf "${DOTFILES}/hypr/bindings.lua" "${HYPR_CONFIG_DIR}/bindings.lua"
ln -sf "${DOTFILES}/hypr/input.lua" "${HYPR_CONFIG_DIR}/input.lua"
ln -sf "${DOTFILES}/hypr/looknfeel.lua" "${HYPR_CONFIG_DIR}/looknfeel.lua"
ln -sf "${DOTFILES}/hypr/windows.lua" "${HYPR_CONFIG_DIR}/windows.lua"
ln -sf "${DOTFILES}/hypr/hyprpaper.conf" "${HYPR_CONFIG_DIR}/hyprpaper.conf"
ln -sf "${DOTFILES}/hypr/hypridle.conf" "${HYPR_CONFIG_DIR}/hypridle.conf"
ln -sf "${DOTFILES}/hypr/hyprlock.conf" "${HYPR_CONFIG_DIR}/hyprlock.conf"
ln -sf "${DOTFILES}/hypr/xdph.conf" "${HYPR_CONFIG_DIR}/xdph.conf"
ln -sf "${DOTFILES}/hypr/waybar/config.jsonc" "${WAYBAR_CONFIG_DIR}/config"
ln -sf "${DOTFILES}/hypr/waybar/style.css" "${WAYBAR_CONFIG_DIR}/style.css"
ln -sf "${DOTFILES}/hypr/waybar/frappe.css" "${WAYBAR_CONFIG_DIR}/frappe.css"
ln -sf "${DOTFILES}/hypr/waybar/battery-status" "${WAYBAR_CONFIG_DIR}/battery-status"
ln -sf "${DOTFILES}/hypr/mako/config" "${MAKO_CONFIG_DIR}/config"
ln -sf "${DOTFILES}/hypr/fuzzel/fuzzel.ini" "${FUZZEL_CONFIG_DIR}/fuzzel.ini"
ln -sf "${DOTFILES}/hypr/voxtype/config.toml" "${VOXTYPE_CONFIG_DIR}/config.toml"
ln -sf "${DOTFILES}/hypr/fcitx5/config" "${FCITX_CONFIG_DIR}/config"
ln -sf "${DOTFILES}/hypr/uwsm/env" "${UWSM_CONFIG_DIR}/env"
ln -sf "${DOTFILES}/hypr/cliphist/config" "${CLIPHIST_CONFIG_DIR}/config"
ln -sf "${DOTFILES}/hypr/systemd/user/cliphist-image.service" "${SYSTEMD_USER_DIR}/cliphist-image.service"
ln -sf "${DOTFILES}/hypr/systemd/user/cliphist-text.service" "${SYSTEMD_USER_DIR}/cliphist-text.service"


voxtype setup --download --model large-v3-turbo --no-post-install

if [ "$(readlink -f /usr/bin/voxtype)" != "/usr/lib/voxtype/voxtype-vulkan" ]; then
    sudo voxtype setup onnx --disable
    sudo voxtype setup gpu --enable
fi

systemctl --user daemon-reload
systemctl --user enable --now "${services[@]}"
systemctl --user restart voxtype.service
