---
name: hypruse
description: Inspect and control the live Hyprland desktop through the hypruse CLI, including native apps, windows, workspaces, screenshots, and input. Use only when explicitly invoked.
disable-model-invocation: true
---

# Hypruse

Run commands through `uvx hypruse`. Before operating the desktop, read the packaged skill:

```bash
uvx hypruse skill -h
HYPRUSE_SKILL_DIR="$(uvx hypruse skill path)"
cat "$HYPRUSE_SKILL_DIR/SKILL.md"
```

Read its references as needed, relative to `HYPRUSE_SKILL_DIR`:

- `references/verbs.md`: command flags, output shapes, coordinates, and exit codes.
- `references/recipes.md`: worked workflows and troubleshooting.
- [Upstream repository](https://github.com/IlyasKhallouki/hypruse): dependencies, setup, and project documentation.

Discover current syntax and check the session:

```bash
uvx hypruse --help
uvx hypruse <verb> [<action>] --help
uvx hypruse doctor
uvx hypruse desktop
```

Use `hypr` for windows/workspaces, `launch` for apps, `ui`/`click_ui` for named controls, and `screenshot`/`zoom`/`pointer` when the accessibility tree cannot help. Use `keyboard` for app input, `binds`/`use_bind` for compositor shortcuts, and `wait_for` for events. Follow the packaged skill's observe, act, verify loop and trust guards within the user's authorized scope.

Prefer a browser tool for web pages. This skill is for live desktop interaction; edit Hyprland configuration directly when requested.
