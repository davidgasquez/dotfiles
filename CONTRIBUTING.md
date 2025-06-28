# Contributing

This repository tracks some of the dotfiles for an Arch Linux installation. Uses Hyprland as the window manager with the Catppuccin Frappe theme across all the different applications. The configuration uses symbolic links to manage dotfiles across various applications.

## Architecture

The repository follows a modular structure where each application has its own directory with configuration files. The Makefile automates the creation of symbolic links from the dotfiles to their expected locations in `$HOME/.config/` or other standard directories.

### Patterns and Principles

- **Simple options**: Use the simplest approach/tool to keep the system clean and tidy
- **Symbolic linking**: All configurations are symlinked rather than copied
- **Modular organization**: Each tool/application has its own directory
- **Make-based automation**: Each component can be set up independently
- **Theme consistency**: Catppuccin Frappe theme used across all applications

## Development Workflow

1. Edit configuration files directly in this repository
2. Use appropriate `make` target to create/update symbolic links
3. Changes take effect immediately since files are symlinked

## Code Conventions

- Be concise and direct
- Follow existing code conventions in the codebase
- Verify changes work by running relevant commands
