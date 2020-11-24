DOTFILES := $(shell pwd)

.DEFAULT_GOAL := help

.PHONY: help
help:
	@ echo -e "Usage: \tmake [TARGET]\n"
	@ echo -e "Targets:"
	@ echo -e "  install-packages    	  Installs all the packages"

.PHONY: initrc
initrc:
	@ ln -sf $(DOTFILES)/xinitrc $(HOME)/.xinitrc

.PHONY: shell
shell:
	@ ln -sf $(DOTFILES)/shell/aliases $(HOME)/.aliases
	@ ln -sf $(DOTFILES)/shell/config.fish $(HOME)/.config/fish/config.fish
	@ ln -sf $(DOTFILES)/shell/starship.toml $(HOME)/.config/starship.toml
	@ ln -sf $(DOTFILES)/shell/localrc $(HOME)/.localrc
	@ ln -sf $(DOTFILES)/shell/functions $(HOME)/.functions
	@ ln -sf $(DOTFILES)/shell/zshrc $(HOME)/.zshrc
	@ antibody bundle < $(DOTFILES)/shell/zsh_plugins.txt > ~/.zsh_plugins.sh

.PHONY: gitconfig
gitconfig:
	@ ln -sf $(DOTFILES)/git/gitconfig $(HOME)/.gitconfig

.PHONY: scripts
scripts:
	@ sudo cp $(DOTFILES)/scripts/* /usr/local/bin

.PHONY: network
network:
	@ sudo ln -sf $(DOTFILES)/network/resolv.conf.head /etc/resolv.conf.head

.PHONY: taskwarrior
taskwarrior:
	@ ln -sf $(DOTFILES)/taskwarrior/taskrc $(HOME)/.taskrc

.PHONY: fonts
fonts:
	@ mkdir -p $(HOME)/.config/fontconfig/conf.d
	@ ln -sf $(DOTFILES)/fonts/local.conf $(HOME)/.config/fontconfig/fonts.conf
	@ ln -sf $(DOTFILES)/fonts/01-emoji.conf $(HOME)/.config/fontconfig/conf.d/01-emoji.conf

.PHONY: vscode
vscode:
	@ mkdir -p "$(HOME)/.config/Code/User/"
	@ cat vscode/extensions | xargs -L 1 code --install-extension
	@ ln -sf $(DOTFILES)/vscode/settings.json "$(HOME)/.config/Code/User/settings.json"
	@ ln -sf $(DOTFILES)/vscode/keybindings.json "$(HOME)/.config/Code/User/keybindings.json"

.PHONY: terminal
terminal:
	@ mkdir -p "$(HOME)/.config/alacritty"
	@ ln -sf $(DOTFILES)/alacritty.yml $(HOME)/.config/alacritty/alacritty.yml

.PHONY: i3
i3:
	@ ln -sf $(DOTFILES)/i3/Xresources $(HOME)/.Xresources
	@ ln -sf $(DOTFILES)/i3/theme.Xresources $(HOME)/.theme.Xresources
	@ ln -sf $(DOTFILES)/i3/compton.conf $(HOME)/.compton.conf
	@ mkdir -p "$(HOME)/.config/dunst"
	@ ln -sf $(DOTFILES)/i3/dunstrc $(HOME)/.config/dunst/dunstrc
	@ ln -sf $(DOTFILES)/i3/i3-config $(HOME)/.config/i3/config
	@ xrdb $(HOME)/.Xresources

.PHONY: sway
sway:
	@ mkdir -p $(HOME)/.config/sway $(HOME)/.config/waybar $(HOME)/.config/wofi $(HOME)/.config/mako
	@ ln -sf $(DOTFILES)/sway/config $(HOME)/.config/sway/config
	@ ln -sf $(DOTFILES)/sway/env $(HOME)/.pam_environment
	@ ln -sf $(DOTFILES)/sway/waybar/config.jsonc $(HOME)/.config/waybar/config
	@ ln -sf $(DOTFILES)/sway/waybar/style.css $(HOME)/.config/waybar/style.css
	@ ln -sf $(DOTFILES)/sway/wofi/config $(HOME)/.config/wofi/config
	@ ln -sf $(DOTFILES)/sway/wofi/style.css $(HOME)/.config/wofi/style.css
	@ ln -sf $(DOTFILES)/sway/mako/config $(HOME)/.config/mako/config

.PHONY: polybar
polybar:
	@ ln -sf $(DOTFILES)/polybar/config $(HOME)/.config/polybar/config
	@ ln -sf $(DOTFILES)/polybar/music.sh $(HOME)/.config/polybar/music.sh
	@ ln -sf $(DOTFILES)/polybar/launch-polybar.sh $(HOME)/.config/polybar/launch.sh

.PHONY: install-packages
install-packages:
	yay --needed -S - < packages
