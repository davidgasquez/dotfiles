---
description: Maintain this Arch Linux workstation
---
Perform appropriate maintenance on this workstation.

## Inspect first

Gather enough context to choose useful maintenance tasks:

- Check which maintenance tools are installed and whether Pacman, Paru, Docker, or Btrfs work is already running.
- Check physical disk health, filesystem types, mount usage, free space, TRIM scheduling, and Btrfs allocation when `/` is Btrfs.
- Check `/boot` usage, boot entries, the running kernel, installed kernel modules, and initramfs errors.
- Check failed system and user units, enabled timers, recent errors, journal size, and coredumps.
- Check orphaned and foreign packages, known package vulnerabilities, pending Pacman configuration files, and package cache sizes.
- Check Docker disk usage, the trash, and the largest user cache directories.

Do not blindly run every command. Skip work that is unnecessary, unsafe, or already handled by an active service or timer.

## Safety

- Run commands inline. Do not create scripts or modify this repository.
- Before Pacman or Paru operations, confirm that neither program is running and that `/var/lib/pacman/db.lck` is absent.
- Explain the exact impact before destructive or privileged commands.
- Use `pkexec` with absolute executable paths instead of `sudo`.
- Preview removals when the tool supports it.
- Do not merge or remove `.pacnew` and `.pacsave` files automatically.
- Do not perform a full system or tool update unless requested.
- Do not install a missing maintenance or audit tool unless requested.
- Do not start SMART self-tests automatically.
- Do not start a Btrfs scrub or balance while another Btrfs operation is active.
- Preserve command output and continue when independent tasks fail.

## System health

- Check `/usr/bin/systemctl --failed` and `/usr/bin/systemctl --user --failed`.
- Review enabled timers and services whose enabled and active states differ.
- Check `/usr/bin/journalctl --disk-usage` and recent errors with `/usr/bin/journalctl --priority=err --boot`.
- Review kernel warnings with `/usr/bin/journalctl --dmesg --boot --priority=warning`. Ignore routine firewall blocks and summarize I/O, filesystem, thermal, out-of-memory, and machine-check errors.
- Verify clock synchronization with `/usr/bin/timedatectl show --property=NTPSynchronized --value`.
- Review up to 20 recent coredumps with `/usr/bin/coredumpctl list --reverse -n 20` and check the size of `/var/lib/systemd/coredump`. Keep recent dumps that may still be useful for debugging.
- If `lsof` is installed, inspect deleted open files with `pkexec /usr/bin/lsof +L1 -nP`. Summarize deleted executables, libraries, and large files instead of returning the full listing.
- Vacuum the journal only when its size warrants it. One example is `pkexec /usr/bin/journalctl --vacuum-size=200M`.

## Storage and boot

- Identify each physical SSD. If `smartctl` is installed, review its health data and self-test history with `pkexec /usr/bin/smartctl --all <device>`. Report failing health status, significant error counters, and failed or incomplete tests, but do not start a test automatically.
- Check whether `fstrim.timer` is enabled and scheduled, then check the last `fstrim.service` result. The service is normally inactive between runs. Do not run `fstrim` manually when the timer already covers the SSDs.
- Check free space on `/boot` and inspect boot entries with `/usr/bin/bootctl status` when `bootctl` is applicable.
- Compare the running kernel with the boot entries and directories under `/usr/lib/modules`. Confirm that the running kernel still has its module directory, and report module directories that no installed kernel owns. Do not rely only on package and `uname` version strings because their formats may differ.
- Confirm that each boot entry refers to an existing kernel and initramfs image. Review recent boot and `mkinitcpio` errors, but do not rebuild an image without a specific failure.
- Report when a newer installed kernel, a missing module directory, or deleted open executables and libraries indicate that a restart is needed.

## Packages and package caches

- List orphaned packages with `/usr/bin/pacman -Qdtq`. An orphan can still be used directly, so inspect each package with `/usr/bin/pacman -Qi` before removal.
- Preview the full recursive removal with `/usr/bin/pacman -Rs --print <packages>`. Inspect every additional dependency in the preview, then remove confirmed packages with `pkexec /usr/bin/pacman --noconfirm -Rns <packages>`.
- Review foreign packages with `/usr/bin/pacman -Qm`. Identify obsolete AUR or manually installed packages, but do not treat every foreign package as unused.
- If `arch-audit` is installed, run it and report vulnerable packages without updating them automatically.
- If `checkupdates` is installed, use its output to flag an outdated `archlinux-keyring` package. Do not refresh package databases or update the package automatically.
- Use `/usr/bin/pacman -Qkk <package>` only when a package is suspected to be damaged. Do not scan the whole system by default, and distinguish expected changes to backup configuration files from missing or altered package files.
- Report pending `.pacnew` and `.pacsave` files with `/usr/bin/pacdiff --output`.
- Preview package cache cleanup with `/usr/bin/paccache -d -v`. If cleanup is useful, run `pkexec /usr/bin/paccache -r`, which keeps three versions by default.
- Inspect old `download-*` directories in `/var/cache/pacman/pkg`. Resolve and review each exact path, its owner and age, and whether any process has it open. Remove only stale directories after confirming that no package operation is active, and never use a wildcard deletion command.
- Inspect the Paru cache. Prefer removing clones for packages that are no longer installed before clearing rebuild data for installed packages.

## User data and tool caches

- Measure the trash and the largest directories under `~/.cache` and `~/.npm` before choosing what to clean.
- Count the entries reported by `/usr/bin/gio trash --list` and inspect a bounded sample. Empty the trash with `/usr/bin/gio trash --empty` only after explaining that the recovery copies will be deleted.
- Consider `/usr/bin/uv cache clean`.
- Use `/usr/bin/npm cache verify` before considering `/usr/bin/npm cache clean --force`.
- Inspect the Bun cache with `/usr/bin/bun pm cache`. Clear it with `/usr/bin/bun pm cache rm` only when its size warrants it.

## Docker

- Start with `/usr/bin/docker system df --verbose`.
- Inspect stopped containers, unused images, unused networks, build cache, and volumes before pruning.
- Use `/usr/bin/docker system prune --all --force` only after confirming that no stopped container or unused image must be kept.
- Do not pass `--volumes` unless the user explicitly requests volume deletion.

## Btrfs

- Check the filesystem with `/usr/bin/btrfs filesystem usage /`.
- Check scrub state with `pkexec /usr/bin/btrfs scrub status /`. Start `pkexec /usr/bin/btrfs scrub start -Bd /` only when a scrub is due.
- Check balance state with `pkexec /usr/bin/btrfs balance status /`. Run a filtered balance only when allocation data shows pressure, and choose filters from the current allocation state.

Finish with completed, skipped, and failed tasks. Report disk space reclaimed, unresolved health warnings, and any restart that is still needed.
