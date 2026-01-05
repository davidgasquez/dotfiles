<div align="center">
  <h1>.dotfiles</h1>
  <p><em>Here you will find my dotfiles, living in peace and harmony.</em></p>
</div>

![image](https://github.com/davidgasquez/dotfiles/assets/1682202/6c4492d8-98ce-4430-9921-4d7ba70f4193)

## 🔍 Overview

- **OS:** Arch Linux
- **WM**: [Hyprland](https://hyprland.org/)
- **Launcher**: [Fuzzel](https://codeberg.org/dnkl/fuzzel)
- **Terminal**: [Alacritty](https://github.com/alacritty/alacritty)
- **Theme**: [Catppuccin](https://github.com/catppuccin/catppuccin) (Frappe flavor)
- **Shell**: `zsh` with [Starship](https://starship.rs/) prompt and [Sheldon](https://sheldon.cli.rs/) plugin manager
- **Coding**: VS Code, Codex, and Pi
- **Note-taking**: VS Code with Foam Extension

## 📦 Configuration

Follow the [Arch Linux installation guide](https://wiki.archlinux.org/title/Installation_guide) to set up your system.

Once Arch is installed and this repository cloned locally, the fastest way to set up the system is by running the different `make` targets defined in the `Makefile`. Each target handles the configuration for different components of the system.

For example, to set up your shell configuration:

```bash
make terminal
```

### Environment variables

- User session variables and secrets live in `~/.config/environment.d/*.conf`.
- Per project values go in a `.env` file in the project root. `terminal/zshrc` auto loads `.env` on directory change if the file is owned by you.

### 🧰 Utility Scripts

The repository includes several useful scripts in the `scripts/` directory.

### 🔧 Post-Installation Steps

After setting up the basic configuration, run:

```bash
make post-installation
```

These steps need to be done manually until I automate them!

## 📜 License

MIT © David Gasquez
