DOTFILES := $(shell pwd)

.PHONY: help
help:
	@ grep "^[a-zA-Z].*:" Makefile | cut -d: -f1 | grep -v "DOTFILES"

.PHONY: lint-sh
lint-sh:
	@ rg --files -g '*.sh' -g 'scripts/*' -g '*/setup.sh' | while IFS= read -r file; do \
		first_line=$$(head -n 1 "$$file"); \
		case "$$first_line" in *python*|*"uv run --script"*) continue ;; esac; \
		shellcheck -x --shell=bash "$$file"; \
	done

.PHONY: paru
paru:
	@ sudo pacman -S --needed base-devel
	@ tmp=$$(mktemp -d); trap 'rm -rf "$$tmp"' EXIT; \
		git clone https://aur.archlinux.org/paru.git "$$tmp"; \
		cd "$$tmp" && makepkg -si

.PHONY: git
git:
	@ ${DOTFILES}/git/setup.sh

.PHONY: fonts
fonts:
	@ $(DOTFILES)/fonts/setup.sh

.PHONY: agents
agents:
	@ $(DOTFILES)/agents/setup.sh

.PHONY: zed
zed:
	@ $(DOTFILES)/zed/setup.sh

.PHONY: terminal
terminal:
	@ $(DOTFILES)/terminal/setup.sh

.PHONY: secrets
secrets:
	@ $(DOTFILES)/secrets/setup.sh

.PHONY: hypr
hypr:
	@ ${DOTFILES}/hypr/setup.sh

.PHONY: desktop
desktop:
	@ ${DOTFILES}/desktop/setup.sh

.PHONY: steam
steam:
	@ ${DOTFILES}/tools/steam/setup.sh

.PHONY: llama
llama:
	@ ${DOTFILES}/tools/llama/setup.sh

.PHONY: system
system:
	@ $(DOTFILES)/system/setup.sh

.PHONY: zephyr
zephyr:
	@ ${DOTFILES}/hosts/zephyr/setup.sh

.PHONY: helix
helix:
	@ ${DOTFILES}/hosts/helix/setup.sh

.PHONY: check
check: lint-sh
	@ prek run --all-files
	@ git ls-files -z '*.lua' | xargs -0 -r luac -p
	@ systemd-analyze --user verify hypr/systemd/user/*.service
	@ systemd-analyze verify secrets/*.service secrets/*.timer
	@ if [ -n "$${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then test -z "$$(hyprctl configerrors)"; fi

.PHONY: doctor
doctor:
	@ scripts/doctor
