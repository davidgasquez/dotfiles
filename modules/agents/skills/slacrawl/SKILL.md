---
name: slacrawl
description: "Search, read, and sync the local Slack Desktop archive."
disable-model-invocation: true
---

# Slacrawl

Read the guide bundled with the repo-pinned package source:

```bash
cat "$(nix build --no-link --print-out-paths /etc/nixos#slacrawl.src)/.agents/skills/slacrawl/SKILL.md"
```

Use the installed `slacrawl` CLI with local archive data only. Skip the upstream API, MCP, git share, and repo-development guidance.

- Refresh only with `slacrawl sync --source wiretap` when the archive is stale or the user requests a sync. It reads cached messages and replies from every Slack Desktop workspace; opening older chats and scrolling in Slack can populate more cache first.
- Missing results do not establish that a message never existed; report cache coverage and sync omissions.
- Put `--json` before the subcommand (`slacrawl --json search ...`) and use it for full message text.
- Search and messages default to 50 results; zero or negative limits also mean 50, not unlimited.
- Use `--workspace` to scope queries and resolve user/channel IDs before filtering.
- In read-only SQL, exclude deleted messages with `coalesce(deleted_ts, '') = ''` and select thread roots and replies by channel and timestamp.
