# Personal NixOS Configuration ❄️

The declarative home for my system and dotfiles, where they live in harmony, most of the time.

## 🔍 Overview

- **OS:** NixOS with Home Manager
- **WM:** [Hyprland](https://hyprland.org/)
- **Launcher:** [Fuzzel](https://codeberg.org/dnkl/fuzzel)
- **Terminal:** [Ghostty](https://ghostty.org/)
- **Theme:** [Catppuccin](https://github.com/catppuccin/catppuccin) (Frappé)
- **Shell:** `zsh` with [Starship](https://starship.rs/)
- **Coding:** Zed, T3 Code, Codex, Claude Code, and Pi

## 📦 Configuration

The repository lives at `/etc/nixos` on Helix, Zephyr, and Tau. Helix and Zephyr share the desktop modules, with hardware and laptop settings under `hosts/`.

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

A nightly GitHub workflow updates and checks `flake.lock`, then pushes it. Before each automatic upgrade, every host fast-forwards its `/etc/nixos` checkout from `origin/main` and rebuilds it without updating the lock file. Helix and Zephyr upgrade daily, catch up missed runs after sleep, and on failure start a T3 Code diagnosis thread. Running applications pick up updates when restarted, and kernel updates require a reboot; the desktops never reboot automatically. Tau upgrades at 02:00 and may reboot between 02:00 and 05:00.

## 📜 License

MIT © David Gasquez
