#!/bin/sh

# Get the dir of the current script
script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

echo $script_dir
echo "Updating system dotfiles:"

# Bash
echo " - bash"
ln -sf $script_dir/bash/bashrc ~/.bashrc
ln -sf $script_dir/bash/bash_aliases ~/.bash_aliases

# Git
echo " - gitconfig"
ln -sf $script_dir/git/gitconfig ~/.gitconfig

# Terminator
echo " - terminator"
ln -sf $script_dir/terminator/config ~/.config/terminator/config

# Task
echo " - taskwarrior"
ln -sf $script_dir/taskwarrior/taskrc ~/.taskrc

echo " - atom"
ln -sf $script_dir/atom/config.cson ~/.atom/config.cson
ln -sf $script_dir/atom/keymap.cson ~/.atom/keymap.cson
ln -sf $script_dir/atom/snippets.cson ~/.atom/snippets.cson

echo " - redshift"
ln -sf $script_dir/redshift/redshift.conf ~/.config/redshift.conf

echo " - tmux"
ln -sf $script_dir/tmux/tmux.conf ~/.tmux.conf

echo
echo "Done!"
echo
