<div align="center">
  <h1>.dotfiles</h1>
  <p><em>Here you will find my dotfiles, living in peace and harmony.</em></p>
</div>

![image](https://github.com/davidgasquez/dotfiles/assets/1682202/6c4492d8-98ce-4430-9921-4d7ba70f4193)

## 🔍 Overview

- **OS:** Arch Linux
- **WM**: [Hyprland](https://hyprland.org/)
- **Launcher**: [Fuzzel](https://codeberg.org/dnkl/fuzzel)
- **Terminal**: [Ghostty](https://ghostty.org/) by default, with [Alacritty](https://alacritty.org/) installed too
- **Theme**: [Catppuccin](https://github.com/catppuccin/catppuccin) (Frappe flavor)
- **Shell**: `zsh` with [Starship](https://starship.rs/) prompt and [Sheldon](https://sheldon.cli.rs/) plugin manager
- **Coding**: Zed, Codex, and Pi

## 📦 Configuration

Follow the [Arch Linux installation guide](https://wiki.archlinux.org/title/Installation_guide) to set up your system.

Once Arch is installed and this repository cloned locally, run the `make` targets defined in the `Makefile`. Each target handles one part of the system.

Common targets:

```bash
make paru      # install paru AUR helper
make terminal  # shell, prompt, terminal config
make git       # git config
make fonts     # font setup
make zed       # Zed config
make agents    # agent config
make secrets   # gopass and secret sync setup
make hypr      # Hyprland config
make desktop   # desktop app flags/config
make system    # system config files
```

### Environment Variables

- Secrets live in `gopass` with the store synced at `~/.secrets`; run `make secrets` to install the sync service and timer.
- User session variables live in `~/.config/environment.d/*.conf`.
- Per-project values go in a `.env` file in the project root. `terminal/zshrc` auto-loads `.env` on directory change if the file is owned by you.

### 🧰 Utility Scripts

The repository includes useful scripts in the `scripts/` directory, including:

- `web-fetch`: convert public web pages to Markdown
- `dirty-dirs-git` / `pull-all-dirs`: manage multiple git repositories
- `record-audio`: audio recording helper
- `pi-sandbox`: Pi agent helper

## 📜 License

MIT © David Gasquez
