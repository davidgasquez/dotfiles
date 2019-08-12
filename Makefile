DOTFILES := $(shell pwd)

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo -e "Usage: \tmake [TARGET]\n"
	@echo -e "Targets:"
	@echo -e "  setup                     Apply minimal configuration to the system"
	@echo -e "  install-aur-packages      Installs some AUR packages"
	@echo -e "  install-basic-packages    Installs basic packages from the oficial repositories"

.PHONY: initrc
initrc:
	@ln -sf $(DOTFILES)/xinitrc $(HOME)/.xinitrc

.PHONY: shell
shell:
	@ln -sf $(DOTFILES)/shell/bashrc $(HOME)/.bashrc
	@ln -sf $(DOTFILES)/shell/aliases $(HOME)/.aliases
	@ln -sf $(DOTFILES)/shell/localrc $(HOME)/.localrc
	@ln -sf $(DOTFILES)/shell/functions $(HOME)/.functions
	@ln -sf $(DOTFILES)/shell/zshrc $(HOME)/.zshrc
	@ln -sf $(DOTFILES)/shell/antigenrc $(HOME)/.antigen/.antigenrc

.PHONY: tmux
tmux:
	@ln -sf $(DOTFILES)/tmux/tmux.conf $(HOME)/.tmux.conf

.PHONY: gitconfig
gitconfig:
	@ln -sf $(DOTFILES)/git/gitconfig $(HOME)/.gitconfig

.PHONY: scripts
scripts:
	@sudo cp $(DOTFILES)/scripts/* /usr/local/bin

.PHONY: network
network:
	@sudo ln -sf $(DOTFILES)/network/resolv.conf.head /etc/resolv.conf.head

.PHONY: taskwarrior
taskwarrior:
	@ln -sf $(DOTFILES)/taskwarrior/taskrc $(HOME)/.taskrc

.PHONY: fonts
fonts:
	@mkdir -p $(HOME)/.config/fontconfig/conf.d
	@ln -sf $(DOTFILES)/fonts/local.conf $(HOME)/.config/fontconfig/fonts.conf
	@ln -sf $(DOTFILES)/fonts/01-emoji.conf $(HOME)/.config/fontconfig/conf.d/01-emoji.conf

.PHONY: vscode
vscode:
	@mkdir -p "$(HOME)/.config/Code - OSS/User/"
	@ln -sf $(DOTFILES)/vscode/settings.json "$(HOME)/.config/Code - OSS/User/settings.json"
	@ln -sf $(DOTFILES)/vscode/keybindings.json "$(HOME)/.config/Code - OSS/User/keybindings.json"

.PHONY: i3L
i3:
	@ ln -sf $(DOTFILES)/i3/Xresources $(HOME)/.Xresources
	@ ln -sf $(DOTFILES)/i3/theme.Xresources $(HOME)/.theme.Xresources
	@ ln -sf $(DOTFILES)/i3/compton.conf $(HOME)/.compton.conf
	@ ln -sf $(DOTFILES)/i3/dunstrc $(HOME)/.config/dunst/dunstrc
	@ ln -sf $(DOTFILES)/i3/i3-config $(HOME)/.config/i3/config
	@ xrdb $(HOME)/.Xresources

.PHONY: polybar
polybar:
	@ ln -sf $(DOTFILES)/polybar/config $(HOME)/.config/polybar/config
	@ ln -sf $(DOTFILES)/polybar/music.sh $(HOME)/.config/polybar/music.sh
	@ ln -sf $(DOTFILES)/polybar/launch-polybar.sh $(HOME)/.config/polybar/launch.sh

setup: shell tmux gitconfig scripts fonts i3 polybar network vscode initrc

install-packages:
	yay -S - < packages
