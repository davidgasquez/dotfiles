# Maintenance

Inspect this Arch Linux workstation, propose worthwhile maintenance, and perform only the approved work. Skip anything irrelevant, unsafe, or already handled by a service or timer.

## Workflow

1. Identify installed maintenance tools and active Pacman, Paru, Docker, or Btrfs operations.
2. Check system health: failed units, recent serious logs, coredumps, clock sync, disk health, and restart indicators.
3. Check storage: mount and Btrfs usage, `/boot`, TRIM, kernel modules, initramfs, package caches, trash, user caches, and Docker usage.
4. Check packages: orphans, foreign packages, known vulnerabilities, and pending `.pacnew` or `.pacsave` files.
5. Present findings and a cleanup plan before making changes.
6. Run approved tasks independently so one failure does not block the rest.
7. Report completed, skipped, and failed tasks; reclaimed space; unresolved warnings; and whether a restart is needed.

## Safety

- Run commands inline; do not create scripts or modify this repository.
- Do not install tools, update the system, merge package configuration, delete Docker volumes, or start SMART tests automatically.
- Before package operations, verify Pacman and Paru are idle and `/var/lib/pacman/db.lck` is absent.
- Preview removals and inspect orphaned packages before deleting them.
- Explain destructive or privileged commands first. Use `pkexec` with absolute executable paths, never `sudo`.
- Start a Btrfs scrub or filtered balance only when due, justified by current state, and no other Btrfs operation is active.
