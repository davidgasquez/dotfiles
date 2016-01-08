#!/bin/sh

echo
echo "Installing Atom..."

# Add
sudo add-apt-repository ppa:webupd8team/atom
sudo apt-get update > /dev/null 2>&1
sudo apt-get install atom -y

echo

echo "Installing Atom Packages..."

apm install atom-beautify
apm install file-icons
apm install linter
apm install minimap
apm install outlander-ui
# Solarflare Syntax

echo

echo -n "Updating Config Files... "

ln -sf ~/projects/dotfiles/atom/config.cson ~/.atom/config.cson
ln -sf ~/projects/dotfiles/atom/keymap.cson ~/.atom/keymap.cson
ln -sf ~/projects/dotfiles/atom/snippets.cson ~/.atom/snippets.cson

echo "Done!"
echo
