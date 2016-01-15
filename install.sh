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
ln -sf ~/projects/dotfiles/terminator/config ~/.config/terminator/config

# Task
echo " - taskwarrior"
ln -sf ~/projects/dotfiles/taskwarrior/taskrc ~/.taskrc

echo " - atom"

ln -sf ~/projects/dotfiles/atom/config.cson ~/.atom/config.cson
ln -sf ~/projects/dotfiles/atom/keymap.cson ~/.atom/keymap.cson
ln -sf ~/projects/dotfiles/atom/snippets.cson ~/.atom/snippets.cson

echo " - redshift"

ln -sf ~/projects/dotfiles/redshift/redshift.conf ~/.config/redshift.conf

echo
echo "Done!"
echo
