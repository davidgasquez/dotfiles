---
name: wacli
description: Interact with WhatsApp. Read messages, sync/search WhatsApp history, or send messages via wacli.
disable-model-invocation: true
---
# wacli

Use `wacli` only when the user explicitly asks you to interact with WhatsApp or when they ask to sync/search WhatsApp history.

## Safety

- Require explicit recipient + message text
- Confirm recipient + message before sending
- If anything is ambiguous (contact, message, search, ...), ask a clarifying question

## Auth and Sync

- `wacli auth` (QR login + initial sync)
- `wacli sync --follow` (continuous sync)
- `wacli doctor`

### Find chats or messages

- `wacli chats list --limit 20 --query "name or number"`
- `wacli messages search "query" --limit 20 --chat <jid>`
- `wacli messages search "invoice" --after 2025-01-01 --before 2025-12-31`

## Inspect or verify messages

- `wacli messages show --chat <jid> --id <message_id> --json --full`
- `messages show` requires both `--chat` and `--id`; do not pass the message ID as a positional argument.
- After sending, verify the stored message when exact formatting matters, especially multiline text.

## History Backfill

- `wacli history backfill --chat <jid> --requests 2 --count 50`

## Send

- Text: `wacli send text --to "+14155551212" --message "Hello! Are you free at 3pm?"`
- Group: `wacli send text --to "1234567890-123456789@g.us" --message "Running 5 min late."`
- File: `wacli send file --to "+14155551212" --file /path/agenda.pdf --caption "Agenda"`
- Multiline: `--message` is literal by default; pass `--message-escapes` to interpret `\n`, `\r`, `\t`.

## Notes

- Run `wacli help` to load that context too and understand the CLI shape.
- Store dir: `~/.wacli` (override with `--store`).
- Use `--json` for machine-readable output when parsing.
- Backfill requires your phone online; results are best-effort.
- JIDs: direct chats look like `<number>@s.whatsapp.net`; groups look like `<id>@g.us` (use `wacli chats list` to find).
- Sync the database before reading.
