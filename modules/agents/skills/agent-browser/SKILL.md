---
name: agent-browser
description: Interact with websites using agent-browser for navigation, forms, screenshots, data extraction, and web app testing.
disable-model-invocation: true
---

# agent-browser

On the NixOS desktops, use the installed CLI. Read the bundled instructions before using the browser:

```bash
agent-browser skills get core
```

For specialized tasks, use `agent-browser skills list` and `agent-browser skills get <name> --full`.

## Temporary Chrome copy by default

Use a private, temporary copy of the user's Chrome profile for browser work, even while Chrome is open. Use `agent-browser profiles` to find the user's profile. Pass its name (usually `Default`) to `--profile`. A filesystem path selects a persistent directory instead.

Set `profile` and `url` for the task and launch a visible Chrome instance:

```bash
copy_dir=$(mktemp -d /tmp/agent-browser.XXXXXXXX) &&
  TMPDIR="$copy_dir" agent-browser \
    --session "copy-${copy_dir##*.}" --profile "$profile" --headed \
    --executable-path "$(command -v google-chrome-stable)" open "$url"
```

The copy uses a local launch with state restoration disabled. Keep the same `TMPDIR` and `--session` for subsequent commands. Use `tab new` for follow-ups and keep the window open if the user needs to sign in. When the user no longer needs the window, run `close` on that session and remove its private directory.

## Live Chrome on request

If the user asks to use their running Chrome, ask them to enable `chrome://inspect/#remote-debugging`, then attach with `--auto-connect --pin-tab` and a fresh named session. Work in a new tab and don't run `close` on the attached browser.
