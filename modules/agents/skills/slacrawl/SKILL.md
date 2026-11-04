---
name: slacrawl
description: "Search, read, and sync the local Slack Desktop archive."
disable-model-invocation: true
---

# Slacrawl

Use local Slack archive data. Refresh from Slack Desktop's cache when the archive is stale or the user requests a sync.

## Sources

- DB: `~/.slacrawl/slacrawl.db`
- Config: `~/.slacrawl/config.toml`
- Cache/logs: `~/.slacrawl/{cache,logs}`
- CLI: `slacrawl`

## Freshness

For recent/current Slack questions:

```bash
slacrawl doctor
slacrawl status --json
```

Refresh:

```bash
slacrawl sync --source wiretap
```

`wiretap` reads cached messages and replies from every workspace in the Slack Desktop profile. Opening older chats and scrolling in Slack can populate more cache before syncing. Missing results do not establish that a message never existed; report cache coverage and sync omissions.

## Query Workflow

1. Resolve workspace, channel/DM, date range, user, and keyword.
2. Check freshness if the question is recent/current.
3. Prefer CLI search/messages for slices; use read-only SQL for exact counts.
4. Report workspace/channel names, date spans, counts, and cache limits.

Use root or subcommand help for syntax: `slacrawl --help`,
`slacrawl search --help`, `slacrawl messages --help`, `slacrawl sql --help`.
`slacrawl search --limit N` is supported.

Common commands:

```bash
slacrawl --json search --limit 20 "query"
slacrawl --json messages --channel C12345678 --limit 50
slacrawl --json channels
slacrawl --json users
slacrawl --json mentions --limit 50
slacrawl --json sql 'select count(*) from messages;'
```

Use JSON for full message text. Search and messages default to 50 results; zero or negative limits also mean 50, not unlimited. Use `--workspace` to scope queries and resolve user/channel IDs before filtering.

Use read-only SQL for date ranges, combined filters, exact counts, and thread retrieval. Exclude deleted messages with `coalesce(deleted_ts, '') = ''`; select thread roots and replies by channel and timestamp. Keep SQL to `select`/`with`.
