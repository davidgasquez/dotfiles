#!/bin/sh

echo
echo "Updating system dotfiles:"

# Bash
echo " - bash"
ln -sf ./bash/bashrc ~/.bashrc
ln -sf ./bash/bash_aliases ~/.bash_aliases

# Git
echo " - gitconfig"
ln -sf ./git/gitconfig ~/.gitconfig

# Terminator
echo " - terminator"
ln -sfT ./terminator/config ~/.config/terminator/config
ln -sfT ./xfce4/xfce4-screenshooter ~/.config/xfce4/xfce4-screenshooter

# Task
echo " - taskwarrior"
ln -sf ./taskwarrior/taskrc ~/.taskrc

echo
echo "Done!"
echo
