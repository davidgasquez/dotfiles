DOTFILES := $(shell pwd)

.PHONY: shell
shell:
	@ mkdir -p $(HOME)/.config/sheldon
	@ ln -sf $(DOTFILES)/shell/zshrc $(HOME)/.zshrc
	@ ln -sf $(DOTFILES)/shell/starship.toml $(HOME)/.config/starship.toml
	@ ln -sf $(DOTFILES)/shell/sheldon/plugins.toml $(HOME)/.config/sheldon/plugins.toml

.PHONY: gitconfig
gitconfig:
	@ ln -sf $(DOTFILES)/git/gitconfig $(HOME)/.gitconfig

.PHONY: fonts
fonts:
	@ mkdir -p $(HOME)/.config/fontconfig/conf.d
	@ ln -sf $(DOTFILES)/fonts/local.conf $(HOME)/.config/fontconfig/fonts.conf
	@ ln -sf $(DOTFILES)/fonts/01-emoji.conf $(HOME)/.config/fontconfig/conf.d/01-emoji.conf

.PHONY: vscode
vscode:
	@ mkdir -p "$(HOME)/.config/Code/User/"
	@ ln -sf $(DOTFILES)/vscode/settings.json "$(HOME)/.config/Code/User/settings.json"
	@ ln -sf $(DOTFILES)/vscode/keybindings.json "$(HOME)/.config/Code/User/keybindings.json"
	@ ln -sf $(DOTFILES)/vscode/code-flags.conf $(HOME)/.config/code-flags.conf

.PHONY: terminal
terminal:
	@ mkdir -p "$(HOME)/.config/alacritty"
	@ ln -sf $(DOTFILES)/alacritty.toml $(HOME)/.config/alacritty/alacritty.toml

.PHONY: hypr
hypr:
	@ mkdir -p "$(HOME)/.config/hypr" "$(HOME)/.config/waybar" "$(HOME)/.config/mako" "$(HOME)/.config/fuzzel"
	@ ln -sf $(DOTFILES)/hypr/frappe.conf $(HOME)/.config/hypr/frappe.conf
	@ ln -sf $(DOTFILES)/hypr/hyprland.conf $(HOME)/.config/hypr/hyprland.conf
	@ ln -sf $(DOTFILES)/hypr/hyprpaper.conf $(HOME)/.config/hypr/hyprpaper.conf
	@ ln -sf $(DOTFILES)/hypr/waybar/config.jsonc $(HOME)/.config/waybar/config
	@ ln -sf $(DOTFILES)/hypr/waybar/style.css $(HOME)/.config/waybar/style.css
	@ ln -sf $(DOTFILES)/hypr/waybar/frappe.css $(HOME)/.config/waybar/frappe.css
	@ ln -sf $(DOTFILES)/hypr/mako/config $(HOME)/.config/mako/config
	@ ln -sf $(DOTFILES)/hypr/fuzzel/fuzzel.ini $(HOME)/.config/fuzzel/fuzzel.ini

.PHONY: brave
brave:
	@ ln -sf $(DOTFILES)/brave-flags.conf $(HOME)/.config/brave-flags.conf
	@ ln -sf $(DOTFILES)/electron-flags.conf $(HOME)/.config/electron-flags.conf

.PHONY: llm
llm:
	@ mkdir -p "$(HOME)/.config/io.datasette.llm/templates"
	@ ln -sf $(DOTFILES)/llm/gitcommit.yaml $(HOME)/.config/io.datasette.llm/templates/gitcommit.yaml
	@ ln -sf $(DOTFILES)/llm/emojidea.yaml $(HOME)/.config/io.datasette.llm/templates/emojidea.yaml
	@ ln -sf $(DOTFILES)/llm/cmd.yaml $(HOME)/.config/io.datasette.llm/templates/cmd.yaml

.PHONY: post-installation
post-installation:
	@ echo "Install missing firmware (https://wiki.archlinux.org/title/Mkinitcpio#Possibly_missing_firmware_for_module_XXXX)"
	@ echo "Setup ZRAM" (https://wiki.archlinux.org/title/Zram#Using_zram-generator)
	@ echo "Reduce swappiness (https://wiki.archlinux.org/title/Swap#Swappiness)
	@ echo "Disable CPU mitigations (https://wiki.archlinux.org/title/Improving_performance#Turn_off_CPU_exploit_mitigations)"
	@ echo "Setup DNS" (Via nm-applet)
