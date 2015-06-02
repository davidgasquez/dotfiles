#!/bin/sh

echo
echo "Updating system dotfiles:"

# Get current directory
current_directory=$(dirname $(readlink -f "$0"))

# Bash
echo " - bash"
ln -sf $current_directory/bash/bashrc ~/.bashrc
ln -sf $current_directory/bash/bash_aliases ~/.bash_aliases

# Git
echo " - gitconfig"
ln -sf $current_directory/git/gitconfig ~/.gitconfig

# xfce-terminal
echo " - xfce4-terminal config"
ln -sfT $current_directory/xfce4/terminal/terminalrc ~/.config/xfce4/terminal/terminalrc
ln -sfT $current_directory/xfce4/xfce4-screenshooter ~/.config/xfce4/xfce4-screenshooter

# gtkrc-2.0
echo " - gtkrc-2.0"
ln -sf $current_directory/xfce4/gtkrc-2.0 ~/.gtkrc-2.0

# Scripts
echo " - scripts"
mkdir -p ~/.scripts
ln -sf $current_directory/scripts/select_sound_card ~/.scripts/select_sound_card

# Task
echo " - taskwarrior"
ln -sf $current_directory/taskwarrior/taskrc ~/.taskrc

echo
echo "Done!"
echo
