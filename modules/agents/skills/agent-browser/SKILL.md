---
name: agent-browser
description: Interact with websites using agent-browser for navigation, forms, screenshots, data extraction, and web app testing.
disable-model-invocation: true
---

# agent-browser

Read the bundled instructions before using the browser:

```bash
nix run 'nixpkgs#agent-browser' -- skills get core
```

Use `nix run 'nixpkgs#agent-browser' --` in place of `agent-browser` in the examples. Use the CLI directly rather than installing it with npm or setting up an MCP integration. For specialized tasks, use `skills list` and `skills get <name> --full` with the same prefix.

To use the user's running Chrome, ask them to enable `chrome://inspect/#remote-debugging`, then attach with `--auto-connect`. Work in a new tab and don't run `close` on the attached browser.
