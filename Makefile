.PHONY: info clean

help:
	@echo -e "Usage: \tmake [TARGET]\n"
	@echo -e "Targets:"
	@echo -e "  install-aur-packages     Installs some AUR packages"
	@echo -e "  install-basic-packages   Installs basic packages from the oficial repositories"

install-basic-packages:
	sudo pacman -S - < basic-packages

install-aur-packages:
	pacaur -S - < aur-packages
