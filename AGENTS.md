# Repository Guidelines

This repository tracks some of the dotfiles for my Arch Linux installation.

## Architecture

- Each directory contains related (and ideally selfcontained) configuration files
- Makefile orchestrates each target

### Patterns and Principles

- **Symbolic linking**: Use symlinks rather than copying dotfiles
- **Modular organization**: Each application or unique setup has its own directory
- **Make-based automation**: The Makefile is the entrypoint that triggers all the subscripts
- **Theme consistency**: Catppuccin Frappe theme used across all applications that support it

## Coding Style & Naming Conventions

- Shell: `#!/usr/bin/env bash` with `set -euo pipefail`; hyphenated script names; keep functions small.
- Make: tabs for recipes; small, composable targets; reuse variables like `DOTFILES`.
- Configs: keep JSON/TOML valid and minimal.
