# Herdr app

Before changing anything here, read the current installed references:

- `hc --skill`: running and coordinating persistent terminals and agents.
- `herdr-app --skill`: controlling the window and safely customizing it.
- `~/.config/herdr-app/AGENTS.md` (or `$HERDR_APP_HOME/AGENTS.md` when set): layouts, settings, keys and mods. Read the adjacent `herdr.d.ts` and `gpui-kit.d.ts` for the APIs you use.

The app regenerates its guide and type declarations on startup; do not edit or copy them into this repository. Keep declarative changes in this repository, not just in the live config directory. Deployment is wired in `../applications.nix` and `../appearance.nix`.

After mod changes, run `herdr-app check <mod folder>`, inspect `herdr-app status` for reload errors, and verify the UI with `herdr-app shot /tmp/herdr-mod.png`. A passing check alone does not validate every runtime state.

Do not restart the user's app or core, or change unrelated spaces, tabs or terminals, without being asked.
