---
name: wacli
description: Interact with WhatsApp. Read messages, sync/search WhatsApp history, or send messages via wacli.
disable-model-invocation: true
---

# wacli

Use `wacli` only when the user explicitly asks you to interact with WhatsApp or to sync/search WhatsApp history.

Read the upstream guide matching the packaged CLI version:

```bash
v=$(wacli version) && curl -fsSL "https://raw.githubusercontent.com/openclaw/wacli/v$v/.agents/skills/wacli/SKILL.md"
```

Use the installed `wacli`. Skip the guide's repo and release sections, and run `wacli <command> --help` for exact flags.

- Sync the local database before reading or searching messages.
- Require an explicit recipient and message text, and confirm both before sending.
- If the contact, message, or search is ambiguous, ask a clarifying question.
- `messages show` requires both `--chat` and `--id`.
- `send text --message` is literal; pass `--message-escapes` to interpret `\n`, `\r`, and `\t`. Verify the stored message with `messages show --json --full` when exact formatting matters.
