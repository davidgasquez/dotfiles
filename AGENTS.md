# Repository Guidelines

This repository tracks some of the dotfiles for an Arch Linux installation. The configuration uses symbolic links to manage dotfiles across various applications.

## Architecture

The architecture follows a modular structure where each directory contains related configuration files. The Makefile automates the creation of symbolic links from the dotfiles to their expected locations in `$HOME/.config/` or other standard directories.

### Patterns and Principles

- **Symbolic linking**: Use symlinks rather than copying dotfiles
- **Modular organization**: Each application or unique setup has its own directory
- **Make-based automation**: The Makefile is the entrypoint that triggers all the subscripts
- **Theme consistency**: Catppuccin Frappe theme used across all applications that support it

## Development Workflow

1. Edit configuration files directly in this repository
2. Make changes to the `.sh` scripts when needed
3. Update or add the appropriate `make` target

## Coding Style & Naming Conventions

- Shell: `#!/usr/bin/env bash` with `set -euo pipefail`; hyphenated script names; keep functions small.
- Make: tabs for recipes; small, composable targets; reuse variables like `DOTFILES`.
- Configs: keep JSON/TOML valid and minimal; prefer Catppuccin Frappe theme for consistency.
- Symlinks: use `ln -sf`/`ln -sfT` as in the Makefile; never copy configs to `$HOME`.
- Be concise and direct.
- Follow existing patterns and conventions in the codebase.
- Verify changes work by running relevant commands.
- Use `sudo` for commands requiring elevated privileges (this matches the Makefile and setup scripts).
- Run `lint-sh` on modified shell scripts before committing.

## Commit & Pull Request Guidelines

- Commits: concise, short, imperative, emoji‑prefixed (e.g., `✨ Add plan command`, `🔧 Update settings`).
- PRs: concise summary, relevant context, related issues.
