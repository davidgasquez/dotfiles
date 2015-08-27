#!/bin/sh

echo
echo "Updating system dotfiles:"

# Bash
echo " - bash"
ln -sf ~/projects/dotfiles/bash/bashrc ~/.bashrc
ln -sf ~/projects/dotfiles/bash/bash_aliases ~/.bash_aliases

# Git
echo " - gitconfig"
ln -sf ~/projects/dotfiles/git/gitconfig ~/.gitconfig

# Terminator
echo " - terminator"
ln -sfT ~/projects/dotfiles/terminator/config ~/.config/terminator/config

# Task
echo " - taskwarrior"
ln -sf ~/projects/dotfiles/taskwarrior/taskrc ~/.taskrc

echo
echo "Done!"
echo
