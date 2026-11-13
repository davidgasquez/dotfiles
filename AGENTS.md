# Repository Guidance

This shared NixOS flake configures `helix` and `zephyr` (`x86_64-linux`, desktops) and `tau` (Raspberry Pi 5, `aarch64-linux`, services). Each machine checks out this repository at `/etc/nixos`.

## Principles

- Keep changes small and declarative following the Nix style and modern best practices
- Make minimal, idiomatic changes
  - Reuse existing modules, options, and abstractions
  - Avoid unnecessary refactoring or introducing new frameworks
- Keep system in sync when making changes
- Respect configuration boundaries
- Code should be self explanatory, no need for useless comments or Markdown files
- Make missing tools available autonomously with `nix run` or `nix shell`
  - If unavailable in Nix, use the official runner with a Nix-provided runtime or a temporary build environment
  - Avoid permanent installation or system configuration changes unless requested
- Use `--no-link` with `nix build` and `nixos-rebuild` build to avoid creating result in this directory
- For rebuilds, use `sudo -n nixos-rebuild`
  - `david` can run this command without a password
  - For other privileged operations, explain the exact action and use inline `pkexec` with an absolute executable path
  - Keep `sudo` on the scripts
- Before changing configurations, check the application's official documentation, repository, or resources for the latest syntax, best practices, deprecations, recommendations, ...
- Deploy safely and preserve rollback options
- This codebase is yours. What it's for and how it's built are your call, and you'll keep building on it so keep it clean and organized in the best way that works for you (context, simplicity, progressive disclosure, ...)

## Commits and Pull Requests

Format changed Nix files with `nix fmt -- <files>` before committing. Use `<gitmoji> <short description>` for both commit subjects and PR titles. Use one actual emoji, an imperative verb, and no trailing period or `feat:`/`fix:` prefixes.

Examples:

- `🔧 Enable automatic garbage collection on tau`
- `🐛 Fix Hyprlock authentication failure text color`
- `📝 Document commit and pull request style`

Keep PR descriptions to 1–3 sentences explaining the change and its reason. Add related issue links and brief validation or deployment notes when useful. Avoid repeating the title, listing changed files, boilerplate sections (Tests, How To Verify, ...), and filler.
