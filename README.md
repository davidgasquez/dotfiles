<div align="center">
  <h1>.dotfiles</h1>
  <p><em>Here you will find my dotfiles, living in harmony and peace.</em></p>
</div>

![image](https://github.com/davidgasquez/dotfiles/assets/1682202/6c4492d8-98ce-4430-9921-4d7ba70f4193)

## 🔍 Overview

My primary OS is **Arch Linux**. These configurations are tuned to work on it. I'm using the [Catppuccin theme colors](https://github.com/catppuccin/catppuccin) (Frappe flavor) across the system for a consistent look and feel.

### 🏗️ Architecture

- **WM**: [Hyprland](https://hyprland.org/) with [Waybar](https://github.com/Alexays/Waybar)
- **Terminal**: [Alacritty](https://github.com/alacritty/alacritty) with Catppuccin theme
- **Shell**: zsh with [Starship](https://starship.rs/) prompt and [Sheldon](https://sheldon.cli.rs/) plugin manager
- **Package Management**: pacman and [uv](https://github.com/astral-sh/uv) for Python
- **Text Expansion**: [Espanso](https://espanso.org/)
- **Editors**: VS Code, Cursor, and Zed
- **Notification**: [Mako](https://github.com/emersion/mako)
- **Launcher**: [Fuzzel](https://codeberg.org/dnkl/fuzzel)
- **CLI Tools**: [llm](https://llm.datasette.io/), [goose](https://github.com/goose-language/goose)

## 🚀 Installation

1. Follow the [Arch Linux installation guide](https://wiki.archlinux.org/title/Installation_guide) to set up your system.
2. Clone this repository:

   ```bash
   git clone https://github.com/davidgasquez/dotfiles.git ~/dotfiles
   cd ~/dotfiles
   ```

3. Install the required packages:

   ```bash
   # Review the packages file first
   cat packages | sudo pacman -S --needed -
   ```

## 📦 Configuration

The fastest way to set up the system is by running the different `make` targets defined in the `Makefile`. Each target handles the configuration for different components of the system.

```bash
# See all available targets
make -n
```

For example, to set up your shell configuration:

```bash
make shell
```

### 🧰 Utility Scripts

The repository includes several useful scripts in the `scripts/` directory:

- `extract-subs` - Extract subtitles from video files
- `q` - Quick search utility
- `vupgrade` - Version upgrade helper
- `yt2srt` - Convert YouTube subtitles to SRT format

### 🔧 Post-Installation Steps

After setting up the basic configuration, run:

```bash
make post-installation
```

## 📜 License

MIT © David Gasquez
