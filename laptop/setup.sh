#!/usr/bin/env bash

# Add ASUS Linux repository
echo "Setting up ASUS Linux repository..."
sudo pacman-key --recv-keys 8F654886F17D497FEFE3DB448B15A6B0E9A3FA35
sudo pacman-key --lsign-key 8F654886F17D497FEFE3DB448B15A6B0E9A3FA35

# Add repository to pacman.conf if not already present
if ! grep -q "\[g14\]" /etc/pacman.conf; then
    echo "Adding g14 repository to pacman.conf..."
    {
        echo ""
        echo "[g14]"
        echo "Server = https://arch.asus-linux.org"
    } | sudo tee -a /etc/pacman.conf > /dev/null
else
    echo "Repository g14 found on pacman.conf"
fi

# Update system
echo "Updating system packages..."
sudo pacman -Suy

packages=(
    brightnessctl
    powertop
    power-profiles-daemon
    plymouth
    python-gobject # Required for power-profiles-daemon
    asusctl
    supergfxctl
    rog-control-center
)

# Install packages
echo "Installing ASUS laptop packages..."
paru -S --needed --noconfirm "${packages[@]}"

# Keyboard
echo "Setting keyboard backlight..."
brightnessctl --device=asus::kbd_backlight set 3

# Power Profiles Daemon
if ! systemctl is-enabled --quiet power-profiles-daemon; then
    echo "Enabling Power Profiles Daemon..."
    sudo systemctl enable --now power-profiles-daemon
else
    echo "Power Profiles Daemon already enabled"
fi

# SuperGFXD
if ! systemctl is-enabled --quiet supergfxd; then
    echo "Enabling SuperGFXD..."
    sudo systemctl enable --now supergfxd
else
    echo "SuperGFXD already enabled"
fi

# Switcheroo Control
if ! systemctl is-enabled --quiet switcheroo-control; then
    echo "Enabling Switcheroo Control..."
    sudo systemctl enable --now switcheroo-control
else
    echo "Switcheroo Control already enabled"
fi

# PowerTOP
echo "Setting up PowerTOP service..."
DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
sudo cp "${DOTFILES}"/laptop/powertop.service /etc/systemd/system/powertop.service
if ! systemctl is-enabled --quiet powertop.service; then
    echo "Enabling PowerTOP service..."
    sudo systemctl enable --now powertop.service
else
    echo "PowerTOP service already enabled"
fi

# Optionally, theme Plymouth (https://github.com/adi1090x/plymouth-themes)
