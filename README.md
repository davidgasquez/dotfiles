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

The repository lives at `/etc/nixos` on Helix and Tau, with a
`~/projects/nixos` symlink on Helix. The `arch` branch preserves the Arch Linux
configuration used by Zephyr.

- `flake.nix` / `flake.lock`: system definitions and pinned dependencies.
- `hosts/`: shared and machine-specific system and Home Manager settings.
- `home/`: shared Home Manager base.
- `modules/`: features pairing system and Home Manager config (`desktop`, `agents` with skills, codex, pi).

Build and apply locally.

```sh
cd /etc/nixos
sudo -n nixos-rebuild build --flake . --no-link
sudo -n nixos-rebuild switch --flake .
```

Update dependencies on Helix with `nixos-update`, review the lock, then commit
and push. Format Nix files with `nix fmt`.

Deploy committed changes to Tau (builds on the Pi):

```sh
git push origin main
ssh tau 'cd /etc/nixos && test "$(git branch --show-current)" = main &&
  test -z "$(git status --porcelain)" &&
  git -c pull.rebase=false -c rebase.autoStash=false pull --ff-only origin main &&
  test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" &&
  sudo -n nixos-rebuild build --flake /etc/nixos#tau --no-link --no-update-lock-file &&
  sudo -n nixos-rebuild switch --flake /etc/nixos#tau --no-update-lock-file'
```

Use `boot` instead of `switch` for kernel changes, then reboot during the
02:00–05:00 maintenance window. Roll back with
`ssh tau sudo -n nixos-rebuild switch --rollback`. Automatic deployments use
the same checkout and keep the existing reboot policy.

## Personal documents

Edit and commit documents in Git, then push to `personal`'s `main` branch.
Tau publishes GitHub to Google Drive every 15 minutes using a dedicated clone
in `~/.local/state/personal-sync/repo`. Drive is a copy for reading and sharing;
edits there are not imported and may be overwritten by the next publication.
The service never commits or pushes, and does not use `~/personal`.

Overwritten or deleted Drive files are moved to dated folders inside
`.personal-sync-backups` on the same Drive remote. This directory is excluded
from publication and is not automatically pruned. Each run allows at most
10 file deletions (a file count, not bisync's percentage).

The existing `personal-drive:` rclone credentials are required. No bisync
initialization or `--resync` is needed. Preview or run a publication on Tau
with the same arguments as the timer:

```sh
systemctl --user stop personal-sync.timer
systemctl --user stop personal-sync.service
STATE_DIRECTORY="$HOME/.local/state/personal-sync" personal-sync --dry-run
systemctl --user start personal-sync.service
systemctl --user start personal-sync.timer
```

On failure, inspect `journalctl --user -u personal-sync.service`. Fix Git access
or rclone credentials and restart the service; no bidirectional state needs
repairing. Restore a Drive backup by copying it into a working Git checkout,
reviewing and committing it, then pushing to `main`.

## 📜 License

MIT © David Gasquez
