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
	@ ln -sf $(DOTFILES)/git/.gitignore_global $(HOME)/.gitignore_global

.PHONY: fonts
fonts:
	@ mkdir -p $(HOME)/.config/fontconfig/conf.d
	@ ln -sf $(DOTFILES)/fonts/local.conf $(HOME)/.config/fontconfig/fonts.conf

.PHONY: vscode
vscode:
	@ mkdir -p "$(HOME)/.config/Code/User/"
	@ ln -sf $(DOTFILES)/vscode/settings.json "$(HOME)/.config/Code/User/settings.json"
	@ ln -sf $(DOTFILES)/vscode/keybindings.json "$(HOME)/.config/Code/User/keybindings.json"
	@ ln -sf $(DOTFILES)/vscode/code-flags.conf $(HOME)/.config/code-flags.conf

.PHONY: cursor
cursor:
	@ mkdir -p "$(HOME)/.config/Cursor/User/"
	@ ln -sf $(DOTFILES)/cursor/settings.json "$(HOME)/.config/Cursor/User/settings.json"
	@ ln -sf $(DOTFILES)/cursor/keybindings.json "$(HOME)/.config/Cursor/User/keybindings.json"
	@ ln -sf $(DOTFILES)/cursor/tasks.json "$(HOME)/.config/Cursor/User/tasks.json"
	@ ln -sf $(DOTFILES)/cursor/mcp.json "$(HOME)/.cursor/mcp.json"
	@ ln -sf $(DOTFILES)/cursor/cursor-flags.conf "$(HOME)/.config/cursor-flags.conf"
	@ sudo install -m 755 $(DOTFILES)/cursor/cursor.sh /usr/bin/cursor

.PHONY: zed
zed:
	@ mkdir -p "$(HOME)/.config/zed/"
	@ ln -sf $(DOTFILES)/zed/settings.json "$(HOME)/.config/zed/settings.json"
	@ ln -sf $(DOTFILES)/zed/keymap.json "$(HOME)/.config/zed/keymap.json"
	@ ln -sf $(DOTFILES)/zed/tasks.json "$(HOME)/.config/zed/tasks.json"

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
	@ ln -sf $(DOTFILES)/hypr/hyprlock.conf $(HOME)/.config/hypr/hyprlock.conf
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
	@ uv tool install llm --with llm-gemini --with llm-anthropic --with llm-deepseek --with llm-groq
	@ mkdir -p "$(HOME)/.config/io.datasette.llm"
	@ ln -sfT $(DOTFILES)/llm "$(HOME)/.config/io.datasette.llm/templates"

.PHONY: goose
goose:
	@ mkdir -p "$(HOME)/.config/goose"
	@ ln -sf $(DOTFILES)/goose/config.yaml $(HOME)/.config/goose/config.yaml
	@ ln -sf $(DOTFILES)/goose/.goosehints $(HOME)/.config/goose/.goosehints

.PHONY: maintenance
maintenance:
	@ docker system prune --volumes --all
	@ uv cache clean
	@ sheldon lock --update
	@ sudo pacman -Sc
	@ uv tool upgrade --all

.PHONY: post-installation
post-installation:
	@ echo "Install missing firmware (https://wiki.archlinux.org/title/Mkinitcpio#Possibly_missing_firmware_for_module_XXXX)"
	@ echo "Setup ZRAM" (https://wiki.archlinux.org/title/Zram#Using_zram-generator)
	@ echo "Reduce swappiness (https://wiki.archlinux.org/title/Swap#Swappiness)"
	@ echo "Disable CPU mitigations (https://wiki.archlinux.org/title/Improving_performance#Turn_off_CPU_exploit_mitigations)"
	@ echo "Setup DNS" (Via nm-applet)
	@ echo "Configure solaar" (https://wiki.archlinux.org/title/Logitech_Unifying_Receiver)
	@ echo "Improve battery life" (https://github.com/AdnanHodzic/auto-cpufreq) and thermald
	@ echo "Enable Scheduled fstrim" (https://wiki.archlinux.org/title/Solid_state_drive#Periodic_TRIM)
	@ echo "Enable Scheduled Mirrorlist Updates" (https://wiki.archlinux.org/title/Reflector)
	@ echo "Enable keyring" (https://wiki.archlinux.org/title/GNOME/Keyring)
	@ echo "Add FilePicker and Desktop Portals" (https://wiki.archlinux.org/title/XDG_Desktop_Portal)
	@ echo "Install uv tools: llm, markitdown, copychat, open-interpreter"
