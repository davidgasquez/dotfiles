DOTFILES := $(shell pwd)

.PHONY: shell
shell:
	@ mkdir -p $(HOME)/.config/sheldon
	@ ln -sf $(DOTFILES)/shell/zshrc $(HOME)/.zshrc
	@ ln -sf $(DOTFILES)/shell/starship.toml $(HOME)/.config/starship.toml
	@ ln -sf $(DOTFILES)/shell/sheldon/plugins.toml $(HOME)/.config/sheldon/plugins.toml

.PHONY: git
git:
	@ ${DOTFILES}/git/packages.sh
	@ ln -sf $(DOTFILES)/git/gitconfig $(HOME)/.gitconfig
	@ ln -sf $(DOTFILES)/git/.gitignore_global $(HOME)/.gitignore_global

.PHONY: fonts
fonts:
	@ $(DOTFILES)/fonts/packages.sh
	# @ mkdir -p $(HOME)/.config/fontconfig/conf.d
	# @ ln -sf $(DOTFILES)/fonts/local.conf $(HOME)/.config/fontconfig/fonts.conf
	# @ fc-cache -fv

.PHONY: espanso
espanso:
	@ mkdir -p $(HOME)/.config/espanso/config $(HOME)/.config/espanso/match
	@ ln -sf $(DOTFILES)/espanso/config.yml $(HOME)/.config/espanso/config/default.yml
	@ ln -sf $(DOTFILES)/espanso/match.yml $(HOME)/.config/espanso/match/base.yml

.PHONY: vscode
vscode:
	@ mkdir -p "$(HOME)/.config/Code/User/"
	@ ln -sf $(DOTFILES)/vscode/settings.json "$(HOME)/.config/Code/User/settings.json"
	@ ln -sf $(DOTFILES)/vscode/keybindings.json "$(HOME)/.config/Code/User/keybindings.json"
	@ ln -sf $(DOTFILES)/vscode/tasks.json "$(HOME)/.config/Code/User/tasks.json"
	@ ln -sf $(DOTFILES)/vscode/code-flags.conf $(HOME)/.config/code-flags.conf

.PHONY: claude
claude:
	@ mkdir -p "$(HOME)/.claude"
	@ ln -sf $(DOTFILES)/claude/settings.json "$(HOME)/.claude/settings.json"
	@ ln -sf $(DOTFILES)/claude/CLAUDE.md "$(HOME)/.claude/CLAUDE.md"
	@ ln -sfT $(DOTFILES)/claude/commands "$(HOME)/.claude/commands"

.PHONY: cursor
cursor:
	@ mkdir -p "$(HOME)/.config/Cursor/User/"
	@ ln -sf $(DOTFILES)/cursor/settings.json "$(HOME)/.config/Cursor/User/settings.json"
	@ ln -sf $(DOTFILES)/cursor/keybindings.json "$(HOME)/.config/Cursor/User/keybindings.json"
	@ ln -sf $(DOTFILES)/cursor/tasks.json "$(HOME)/.config/Cursor/User/tasks.json"
	@ ln -sf $(DOTFILES)/cursor/mcp.json "$(HOME)/.cursor/mcp.json"

.PHONY: zed
zed:
	@ mkdir -p "$(HOME)/.config/zed/"
	@ ln -sf $(DOTFILES)/zed/settings.json "$(HOME)/.config/zed/settings.json"
	@ ln -sf $(DOTFILES)/zed/keymap.json "$(HOME)/.config/zed/keymap.json"
	@ ln -sf $(DOTFILES)/zed/tasks.json "$(HOME)/.config/zed/tasks.json"

.PHONY: terminal
terminal:
	@ $(DOTFILES)/terminal/packages.sh
	@ mkdir -p "$(HOME)/.config/alacritty"
	@ ln -sf $(DOTFILES)/terminal/alacritty.toml $(HOME)/.config/alacritty/alacritty.toml
	@ ln -sf $(DOTFILES)/terminal/bashrc $(HOME)/.bashrc
	@ ln -sf $(DOTFILES)/terminal/blerc.sh $(HOME)/.blerc
	@ ln -sf $(DOTFILES)/terminal/inputrc $(HOME)/.inputrc
	@ ln -sf $(DOTFILES)/terminal/starship.toml $(HOME)/.config/starship.toml

.PHONY: hypr
hypr:
	@ mkdir -p "$(HOME)/.config/hypr" "$(HOME)/.config/waybar" "$(HOME)/.config/mako" "$(HOME)/.config/fuzzel"
	@ ${DOTFILES}/hypr/setup.sh
	@ ln -sf $(DOTFILES)/hypr/wallpaper.png $(HOME)/Pictures/wallpaper.png
	@ ln -sf $(DOTFILES)/hypr/frappe.conf $(HOME)/.config/hypr/frappe.conf
	@ ln -sf $(DOTFILES)/hypr/hyprland.conf $(HOME)/.config/hypr/hyprland.conf
	@ ln -sf $(DOTFILES)/hypr/hyprpaper.conf $(HOME)/.config/hypr/hyprpaper.conf
	@ ln -sf $(DOTFILES)/hypr/hypridle.conf $(HOME)/.config/hypr/hypridle.conf
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
	@ uv tool install --reinstall -U llm --with llm-gemini --with llm-anthropic \
		--with llm-openai-plugin --with llm-github-copilot --with llm-cmd \
		--with llm-fragments-github --with llm-fragments-reader \
		--with llm-fragments-youtube
	@ mkdir -p "$(HOME)/.config/io.datasette.llm"
	@ ln -sfT $(DOTFILES)/llm "$(HOME)/.config/io.datasette.llm/templates"

.PHONY: system
system:
	@ sudo rm /etc/xdg/reflector/reflector.conf /etc/sysctl.d/99-swappiness.conf
	@ sudo cp $(DOTFILES)/system/reflector.conf /etc/xdg/reflector/reflector.conf
	@ sudo cp $(DOTFILES)/system/99-swappiness.conf /etc/sysctl.d/99-swappiness.conf
	@ $(DOTFILES)/system/setup.sh

.PHONY: maintenance
maintenance:
	@ docker system prune --volumes --all
	@ uv cache clean
	@ sheldon lock --update
	@ sudo pacman -Sc
	@ uv tool upgrade --all

.PHONY: post-installation
post-installation:
	@ echo "Setup ZRAM" (https://wiki.archlinux.org/title/Zram#Using_zram-generator)
	@ echo "Disable CPU mitigations (https://wiki.archlinux.org/title/Improving_performance#Turn_off_CPU_exploit_mitigations)"
	@ echo "Setup DNS / Cloudflare WARP"
	@ echo "Configure solaar" (https://wiki.archlinux.org/title/Logitech_Unifying_Receiver)
	@ echo "Improve battery life" (auto-cpufreq, thermald, governor, etc.)
	@ echo "Enable keyring and PAM" (https://wiki.archlinux.org/title/GNOME/Keyring)
	@ echo "Enable SSH Agent" (https://wiki.archlinux.org/title/GNOME/Keyring#SSH_keys)
	@ echo "Install uv tools: llm, markitdown, ..."
