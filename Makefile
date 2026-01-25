DOTFILES := $(shell pwd)

.PHONY: help
help:
	@ grep "^[a-zA-Z].*:" Makefile | cut -d: -f1 | grep -v "DOTFILES"

.PHONY: lint-sh
lint-sh:
	@ rg --files -g '*.sh' -g 'scripts/*' -g '*/setup.sh' | xargs -r shellcheck -x

paru:
	@ sudo pacman -S --needed base-devel
	@ git clone https://aur.archlinux.org/paru.git /tmp/paru
	@ cd /tmp/paru && makepkg -si --noconfirm

.PHONY: git
git:
	@ ${DOTFILES}/git/setup.sh

.PHONY: fonts
fonts:
	@ $(DOTFILES)/fonts/setup.sh

.PHONY: code
code:
	@ $(DOTFILES)/code/setup.sh

.PHONY: agents
agents:
	@ $(DOTFILES)/agents/setup.sh

.PHONY: zed
zed:
	@ mkdir -p "$(HOME)/.config/zed/"
	@ ln -sf $(DOTFILES)/zed/settings.json "$(HOME)/.config/zed/settings.json"
	@ ln -sf $(DOTFILES)/zed/keymap.json "$(HOME)/.config/zed/keymap.json"
	@ ln -sf $(DOTFILES)/zed/tasks.json "$(HOME)/.config/zed/tasks.json"

.PHONY: terminal
terminal:
	@ $(DOTFILES)/terminal/setup.sh

.PHONY: llm
llm:
	@ $(DOTFILES)/llm/setup.sh

.PHONY: hypr
hypr:
	@ ${DOTFILES}/hypr/setup.sh

.PHONY: desktop
desktop:
	@ ${DOTFILES}/desktop/setup.sh

.PHONY: system
system:
	@ $(DOTFILES)/system/setup.sh

.PHONY: maintenance
maintenance:
	@ ${DOTFILES}/scripts/run-maintenance-tasks

.PHONY: laptop
laptop:
	@ ${DOTFILES}/laptop/setup.sh

.PHONY: workstation
workstation:
	@ ${DOTFILES}/workstation/setup.sh

.PHONY: post-installation
post-installation:
	@ echo "GPU Setup"
	@ echo "Pacman/paru config"
	@ echo "Performance Kernel Parameters"
