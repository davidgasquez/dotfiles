---
name: hypruse
description: Inspect and control the live Hyprland desktop through the hypruse CLI, including native apps, windows, workspaces, screenshots, and input. Use only when explicitly invoked.
disable-model-invocation: true
---

# Hypruse

## Execution

Follow [nix-run](../nix-run/SKILL.md). Hypruse has no maintained Nix package; run its official uv runner through `nix run 'nixpkgs#uv' -- tool run hypruse <args>`.
In the examples below and the packaged skill, replace `hypruse` with that prefix.

Before operating the desktop, read the packaged skill:

```bash
hypruse skill -h
HYPRUSE_SKILL_DIR="$(hypruse skill path)"
cat "$HYPRUSE_SKILL_DIR/SKILL.md"
```

Read its references as needed, relative to `HYPRUSE_SKILL_DIR`:

- `references/verbs.md`: command flags, output shapes, coordinates, and exit codes.
- `references/recipes.md`: worked workflows and troubleshooting.
- [Upstream repository](https://github.com/IlyasKhallouki/hypruse): dependencies, setup, and project documentation.

Discover current syntax and check the session:

```bash
hypruse --help
hypruse <verb> [<action>] --help
hypruse doctor
hypruse desktop
```

Use `hypr` for windows/workspaces, `launch` for apps, `ui`/`click_ui` for named controls, and `screenshot`/`zoom`/`pointer` when the accessibility tree cannot help. Use `keyboard` for app input, `binds`/`use_bind` for compositor shortcuts, and `wait_for` for events. Follow the packaged skill's observe, act, verify loop and trust guards within the user's authorized scope.

Prefer a browser tool for web pages. This skill is for live desktop interaction; edit Hyprland configuration directly when requested.
