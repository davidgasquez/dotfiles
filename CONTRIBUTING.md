# Contributing

Guidance when working with code in this repository.

## Overview

This is a dotfiles repository for Arch Linux with Hyprland window manager and Catppuccin Frappe theme. The configuration uses symbolic links to manage dotfiles across various applications.

## Key Commands

### Setup and Configuration

```bash
# View all available make targets
make -n
```

### Package Management

```bash
# Install system packages
cat packages | sudo pacman -S --needed -

# Install/upgrade Python tools with uv
uv tool install --reinstall -U <package>
uv tool upgrade --all
```

### Maintenance

```bash
# Run comprehensive system maintenance
make maintenance

# View post-installation tasks
make post-installation
```

## Architecture

The repository follows a modular structure where each application has its own directory with configuration files. The Makefile automates the creation of symbolic links from the dotfiles to their expected locations in `$HOME/.config/` or other standard directories.

Key architectural patterns:
- **Symbolic linking**: All configurations are symlinked rather than copied
- **Modular organization**: Each tool/application has its own directory
- **Make-based automation**: Each component can be set up independently
- **Theme consistency**: Catppuccin Frappe theme used across all applications

## Development Workflow

1. Edit configuration files directly in this repository
2. Use appropriate `make` target to create/update symbolic links
3. Changes take effect immediately since files are symlinked

## Scripts

Utility scripts in `scripts/` directory:

- `extract-subs` - Extract subtitles from video files
- `q` - Quick search utility
- `setup-agents-context` - Create AI agent context file symlinks
- `vupgrade` - Version upgrade helper
- `yt2srt` - Convert YouTube subtitles to SRT format

## Code Conventions

- Be concise and direct
- Follow existing code conventions in the codebase
- Verify changes work by running relevant commands
