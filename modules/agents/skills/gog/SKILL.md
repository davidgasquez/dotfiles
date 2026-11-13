---
name: gog
description: Google Workspace automation, JSON, auth, scoped reads/writes
disable-model-invocation: true
---

# gog

Use `gog` when built-in Google connectors are missing a feature, when shell
automation needs stable JSON, or when you need to inspect local Google auth
state before acting.

## Fast Path

```bash
gog --version
gog auth list --check --json --no-input
gog auth doctor --check --json --no-input
GOG_HELP=agent gog --help
gog schema --json
```

`GOG_HELP=agent` makes root help emit a compact automation contract and common
read-only recipes; commands and behavior stay unchanged. Machine output,
non-interactive behavior, stable exit codes, command guards, and
untrusted-content wrapping apply across the CLI. `schema` exposes command
syntax, stable exit codes, and effective safety state for automation.

For JSON output projection, `--fields` is accepted as an alias for `--select` on
commands that do not define their own API field-mask `--fields`; commands with a
local field-mask flag keep that command-specific meaning.

`--results-only` unwraps the primary result before `--select` projects it. For
lists, select item-relative fields: `--results-only --select id`. Dot paths do
not broadcast through nested arrays (`--select items.id` selects nothing).
Unmatched object fields are omitted.

Pick the account explicitly for API work:

```bash
gog --readonly --account user@example.com gmail search 'newer_than:7d' --json --wrap-untrusted
```

Prefer `--json --wrap-untrusted` for agent parsing when reading Google content.
Human hints and progress should stay on stderr; stdout is for data.

## Account and authorization

Use the account relevant to the request. On Helix, both Google accounts share
one OAuth client and have separate tokens in GNOME Keyring. If an existing
shell has stale session variables, run `gog` with
`GOG_KEYRING_SERVICE_NAME=Default_Keyring` to use the configured keyring.

Use `--readonly` for reads and `--no-input` for unattended calls. Use
`--dry-run` to preview a write when the command supports it. Keep OAuth
secrets, tokens, and authorization callback URLs out of command output and
chat.

Before reauthorizing, inspect the account's client, services, and scopes with
`gog auth list --check --json --no-input` and preserve the existing grant
unless the user asks to change it. Use `gog auth add --help` to select the
matching options, let the user complete Google consent, and verify the
account and scopes afterward.

## Common Reads

```bash
gog --readonly --account user@example.com gmail search 'newer_than:3d' --max 10 --json --wrap-untrusted
gog --readonly --account user@example.com gmail get <messageId> --sanitize-content --json --wrap-untrusted
gog --readonly --account user@example.com gmail thread get <threadId> --sanitize-content --json --wrap-untrusted

gog --readonly --account user@example.com calendar events --today --json --wrap-untrusted
gog --readonly --account user@example.com meet history <meeting-code> --json
gog --readonly --account user@example.com meet participants <meeting-code> --conference <conference-id> --all --json
gog --readonly --account user@example.com drive ls --max 20 --json --wrap-untrusted
gog --readonly --account user@example.com docs cat <documentId> --json --wrap-untrusted
gog --readonly --account user@example.com sheets get <spreadsheetId> Sheet1!A1:D20 --json --wrap-untrusted
gog --readonly --account user@example.com contacts list --max 20 --json --wrap-untrusted
```

For Gmail body inspection, prefer `--sanitize-content` unless the user
explicitly needs raw payloads.

Calendar lists invitees. Meet lists actual attendees. For recurring links,
choose the conference by time from `meet history`.

## Writes

Before writes, identify the account, object id, and exact mutation. Prefer
commands that support `--dry-run`, and clean up disposable live-test objects.

```bash
gog --account user@example.com docs write <documentId> --append --text '...'
gog --account user@example.com docs write <documentId> --tab "Data" --markdown --replace --file data.md
gog --account user@example.com docs update <documentId> --tab "Data" --markdown --file block.md
gog --account user@example.com docs update <documentId> --tab "Data" --replace-range START:END --text 'replacement'
gog --account user@example.com docs update <documentId> --tab "Data" --markdown --replace-range START:END --file block.md
gog --account user@example.com sheets update <spreadsheetId> Sheet1!A1 --values-json '[["hello"]]'
gog --account user@example.com sheets batch-update <spreadsheetId> --data-json @updates.json
gog --account user@example.com drive upload ./file.txt --parent <folderId> --json
```

For Google Docs tab work:

- Use `docs list-tabs <documentId> --json` to discover tab titles/IDs before targeting a tab.
- Use `docs write --markdown --replace --tab <tab>` for whole-tab formatted replacement.
- Use `docs update --markdown --tab <tab>` for formatted insertion/append without replacing the whole tab.
- Use `docs update --replace-range START:END` for precise plain-text replacement; add `--markdown` to replace that exact range with formatted markdown.
- `START:END` is a Google Docs UTF-16 API range. Resolve it from `docs cat --raw`, `docs raw`, or another `documents.get` readback; do not guess indexes.
- `--replace-range` and `--index` are mutually exclusive.

When testing creation commands, name artifacts with a clear temporary prefix and
delete or trash them after verification.

`gmail batch delete` permanently deletes messages and requires the broader
`https://mail.google.com/` OAuth scope. Prefer `gmail trash`; when permanent
deletion is required, follow the exact reauthorization command printed by `gog`.

For larger Sheets writes, prefer `sheets batch-update` over loops of
`sheets update`; it sends multiple value ranges in one Sheets API request and
accepts inline JSON or `@file` input.

For normal Gmail replies, use the first-class commands instead of rebuilding
reply MIME through `gmail send`:

```bash
gog --account user@example.com gmail reply <messageId> --body-file reply.txt
gog --account user@example.com gmail reply-all <messageId> --body-file reply.txt \
  --bcc introducer@example.com --remove former-participant@example.com
```

They inherit the subject, quote by default, preserve display names and inline
images, and treat `--to`/`--cc`/`--bcc` as additive placement or moves. Use
`--no-quote` to omit the original.

## Discovery

Use generated command docs and schema instead of guessing flags:

```bash
gog <service> --help
gog <service> <command> --help
gog schema <service> <command> --json
```

See the [command reference](https://github.com/openclaw/gogcli/tree/v0.47.1/docs/commands)
and [upstream agent guide](https://github.com/openclaw/gogcli/blob/v0.47.1/docs/agent-skills.md)
for service-specific examples.
