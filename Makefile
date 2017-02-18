DOTFILES := $(shell pwd)

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo -e "Usage: \tmake [TARGET]\n"
	@echo -e "Targets:"
	@echo -e "  setup						Apply minimal configuration to the system"
	@echo -e "  install-aur-packages		Installs some AUR packages"
	@echo -e "  install-basic-packages   	Installs basic packages from the oficial repositories"

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

.PHONY: terminator
terminator:
	@mkdir -p $(HOME)/.config/terminator
	@ln -sf $(DOTFILES)/terminator/config $(HOME)/.config/terminator/config

.PHONY: taskwarrior
taskwarrior:
	@ln -sf $(DOTFILES)/taskwarrior/taskrc $(HOME)/.taskrc

.PHONY: fonts
fonts:
	@mkdir -p $(HOME)/.config/fontconfig/
	@ln -sf $(DOTFILES)/fonts/local.conf $(HOME)/.config/fontconfig/local.conf

.PHONY: atom
atom:
	@mkdir -p $(HOME)/.atom
	@ln -sf $(DOTFILES)/atom/config.cson $(HOME)/.atom/config.cson
	@ln -sf $(DOTFILES)/atom/keymap.cson $(HOME)/.atom/keymap.cson
	@ln -sf $(DOTFILES)/atom/snippets.cson $(HOME)/.atom/snippets.cson

setup: shell tmux gitconfig scripts fonts

install-basic-packages:
	sudo pacman -S - < basic-packages

install-aur-packages:
	pacaur -S - < aur-packages
