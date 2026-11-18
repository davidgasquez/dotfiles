---
name: todoist
description: Manage Todoist tasks, projects, labels, and reminders using the official td CLI. Use for Todoist inbox, today, upcoming tasks, and project organization.
---

# Todoist

Read the guide bundled with the installed `td` before using it.

```bash
(
  set -eu
  scratch=$(mktemp -d)
  trap 'rm -rf "$scratch"' EXIT
  cd "$scratch"
  export HOME="$scratch" XDG_CONFIG_HOME="$scratch/config" XDG_STATE_HOME="$scratch/state"
  td skill install pi --local >&2
  cat .pi/skills/todoist-cli/SKILL.md
)
```

Run actual Todoist commands outside that temporary environment so `td` can access the user's credentials. If sign-in is needed, ask the user to run `td auth login`.
