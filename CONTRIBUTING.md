# Contributing

This repository (@README.md) tracks some of the dotfiles for an Arch Linux installation. The configuration uses symbolic links to manage dotfiles across various applications.

## Architecture

The architecture follows a modular structure where each directory containes related configuration files. The Makefile automates the creation of symbolic links from the dotfiles to their expected locations in `$HOME/.config/` or other standard directories.

### Patterns and Principles

- **Symbolic linking**: Use symlinks rather than copying dotfiles
- **Modular organization**: Each application or unique setup has its own directory
- **Make-based automation**: The Makefile is the entrypoint that triggers all the subscripts
- **Theme consistency**: Catppuccin Frappe theme used across all applications that supports it

## Development Workflow

1. Edit configuration files directly in this repository
3. Make changes to the `.sh` scripts when needed
4. Update or add the appropriate `make` target

## Code Conventions

- Be concise and direct
- Follow existing patterns and conventions in the codebase
- Verify changes work by running relevant commands
- Always use `pkexec` instead of `sudo` for commands requiring elevated privileges
