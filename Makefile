DOTFILES := $(shell pwd)

.DEFAULT_GOAL := help

.PHONY: help
help:
	@ echo -e "Usage: \tmake [TARGET]\n"
	@ echo -e "Targets:"
	@ echo -e "  install-packages    	  Installs all the packages"

.PHONY: shell
shell:
	@ ln -sf $(DOTFILES)/shell/zshrc $(HOME)/.zshrc
	@ ln -sf $(DOTFILES)/shell/starship.toml $(HOME)/.config/starship.toml

.PHONY: gitconfig
gitconfig:
	@ ln -sf $(DOTFILES)/git/gitconfig $(HOME)/.gitconfig

.PHONY: scripts
scripts:
	@ mkdir -p $(HOME)/.local/bin
	@ ln -sf $(DOTFILES)/scripts/* $(HOME)/.local/bin

.PHONY: network
network:
	@ sudo ln -sf $(DOTFILES)/network/resolv.conf.head /etc/resolv.conf.head

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
	@ ln -sf $(DOTFILES)/vscode/code-flags.conf $(HOME)/.config/code-flags.conf

.PHONY: terminal
terminal:
	@ mkdir -p "$(HOME)/.config/alacritty"
	@ ln -sf $(DOTFILES)/alacritty.yml $(HOME)/.config/alacritty/alacritty.yml

.PHONY: hypr
hypr:
	@ mkdir -p "$(HOME)/.config/hypr" "$(HOME)/.config/waybar" "$(HOME)/.config/mako"
	@ ln -sf $(DOTFILES)/hypr/frappe.conf $(HOME)/.config/hypr/frappe.conf
	@ ln -sf $(DOTFILES)/hypr/hyprland.conf $(HOME)/.config/hypr/hyprland.conf
	@ ln -sf $(DOTFILES)/hypr/hyprpaper.conf $(HOME)/.config/hypr/hyprpaper.conf
	@ ln -sf $(DOTFILES)/hypr/waybar/config.jsonc $(HOME)/.config/waybar/config
	@ ln -sf $(DOTFILES)/hypr/waybar/style.css $(HOME)/.config/waybar/style.css
	@ ln -sf $(DOTFILES)/hypr/waybar/frappe.css $(HOME)/.config/waybar/frappe.css
	@ ln -sf $(DOTFILES)/hypr/mako/config $(HOME)/.config/mako/config

.PHONY: sway
sway:
	@ mkdir -p $(HOME)/.config/sway $(HOME)/.config/waybar $(HOME)/.config/wofi $(HOME)/.config/mako $(HOME)/.config/gammastep
	@ ln -sf $(DOTFILES)/sway/config $(HOME)/.config/sway/config
	@ ln -sf $(DOTFILES)/sway/waybar/config.jsonc $(HOME)/.config/waybar/config
	@ ln -sf $(DOTFILES)/sway/waybar/style.css $(HOME)/.config/waybar/style.css
	@ ln -sf $(DOTFILES)/sway/wofi/config $(HOME)/.config/wofi/config
	@ ln -sf $(DOTFILES)/sway/wofi/style.css $(HOME)/.config/wofi/style.css
	@ ln -sf $(DOTFILES)/sway/mako/config $(HOME)/.config/mako/config
	@ ln -sf $(DOTFILES)/gammaset.conf $(HOME)/.config/gammastep/config.ini

.PHONY: brave
brave:
	@ ln -sf $(DOTFILES)/brave-flags.conf $(HOME)/.config/brave-flags.conf
	@ ln -sf $(DOTFILES)/electron-flags.conf $(HOME)/.config/electron-flags.conf

.PHONY: install-packages
install-packages:
	@ yay --needed -S - < packages

.PHONY: post-installation
post-installation:
	@ echo "Install missing firmware (https://wiki.archlinux.org/title/Mkinitcpio#Possibly_missing_firmware_for_module_XXXX)"
	@ echo "Reduce swappiness (https://wiki.archlinux.org/title/Swap#Swappiness)"
	@ echo "Disable CPU mitigations (https://wiki.archlinux.org/title/Improving_performance#Turn_off_CPU_exploit_mitigations)"
	@ echo "Setup DNS" (Via nm-applet)
