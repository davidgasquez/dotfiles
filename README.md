# Personal NixOS Configuration ❄️

The declarative home for my system and dotfiles, where they live in harmony, most of the time.

## 🔍 Overview

- **OS:** NixOS with Home Manager
- **WM:** [Hyprland](https://hyprland.org/)
- **Launcher:** [Fuzzel](https://codeberg.org/dnkl/fuzzel)
- **Terminal:** [Ghostty](https://ghostty.org/)
- **Theme:** [Catppuccin](https://github.com/catppuccin/catppuccin) (Frappé)
- **Shell:** `zsh` with [Starship](https://starship.rs/)
- **Coding:** Zed, Codex, and Pi

## 📦 Configuration

The repository lives at `/etc/nixos` on Helix and Tau.

- `flake.nix` / `flake.lock`: system definitions and pinned dependencies.
- `hosts/`: shared and machine-specific system and Home Manager settings.
- `home/`: shared Home Manager base.
- `modules/`: features pairing system and Home Manager config

You can build and apply locally.

```sh
cd /etc/nixos
sudo -n nixos-rebuild build --flake . --no-link
sudo -n nixos-rebuild switch --flake .
```

A nightly GitHub workflow updates and checks `flake.lock`, then pushes it. Both hosts pull `main` and rebuild.

## 📜 License

MIT © David Gasquez
