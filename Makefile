DOTFILES := $(shell pwd)

.PHONY: help
help:
	@ grep "^[a-zA-Z].*:" Makefile | cut -d: -f1 | grep -v "DOTFILES"

paru:
	@ sudo pacman -S --needed base-devel
	@ git clone https://aur.archlinux.org/paru.git /tmp/paru
	@ cd /tmp/paru && makepkg -si --noconfirm

.PHONY: git
git:
	@ ${DOTFILES}/git/setup.sh

.PHONY: fonts
fonts:
	@ $(DOTFILES)/fonts/packages.sh

.PHONY: code
code:
	@ $(DOTFILES)/code/packages.sh
	@ mkdir -p "$(HOME)/.config/Code/User/"
	@ ln -snf $(DOTFILES)/code/settings.json "$(HOME)/.config/Code/User/settings.json"
	@ ln -snf $(DOTFILES)/code/keybindings.json "$(HOME)/.config/Code/User/keybindings.json"
	@ ln -snf $(DOTFILES)/code/tasks.json "$(HOME)/.config/Code/User/tasks.json"
	@ ln -snf $(DOTFILES)/code/code-flags.conf $(HOME)/.config/code-flags.conf

.PHONY: claude
claude:
	@ curl -fsSL http://claude.ai/install.sh | bash
	@ mkdir -p "$(HOME)/.claude"
	@ ln -sf $(DOTFILES)/claude/settings.json "$(HOME)/.claude/settings.json"
	@ ln -sf $(DOTFILES)/claude/CLAUDE.md "$(HOME)/.claude/CLAUDE.md"
	@ ln -sfT $(DOTFILES)/claude/commands "$(HOME)/.claude/commands"
	@ ln -sfT $(DOTFILES)/claude/agents "$(HOME)/.claude/agents"

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

.PHONY: desktop
desktop:
	@ ${DOTFILES}/desktop/packages.sh
	@ ln -sf $(DOTFILES)/desktop/brave-flags.conf $(HOME)/.config/brave-flags.conf
	@ ln -sf $(DOTFILES)/desktop/electron-flags.conf $(HOME)/.config/electron-flags.conf

.PHONY: system
system:
	@ sudo rm -f /etc/sysctl.d/99-swappiness.conf
	@ sudo cp $(DOTFILES)/system/99-swappiness.conf /etc/sysctl.d/99-swappiness.conf
	@ $(DOTFILES)/system/setup.sh

.PHONY: maintenance
maintenance:
	@ ${DOTFILES}/scripts/run-maintenance-tasks

.PHONY: laptop
laptop:
	@ ${DOTFILES}/laptop/setup.sh

.PHONY: post-installation
post-installation:
	@ echo "Disable CPU mitigations (https://wiki.archlinux.org/title/Improving_performance#Turn_off_CPU_exploit_mitigations)"
	@ echo "Configure solaar" (https://wiki.archlinux.org/title/Logitech_Unifying_Receiver)
	@ echo "Enable PAM" (https://wiki.archlinux.org/title/GNOME/Keyring)
	@ echo "Enable SSH Agent" (https://wiki.archlinux.org/title/GNOME/Keyring#SSH_keys)
