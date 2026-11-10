---
name: subagents
description: Orchestrate and delegate work to other agents with hc. Use only when the operator authorizes delegation.
disable-model-invocation: true
---

# Subagents

Run `hc --skill` and `herdr-app --skill` once for their manuals, then:

- Give each worker one concise, atomic task with context, constraints, expected output, and how to verify their work
- Don't add `herdr.*` labels to workers of a chat shown in Herdr, they appear under it in the Agents list
  - Only when the user wants a worker as its own tab, or this chat has no Herdr pane (e.g. running on ChatGPT app), reuse or create a Herdr space on the worker's machine named after the basename of the chat's working folder (not the worker's temporary checkout), and pass its machine-local ID to `hc run --label "herdr.space=<id>"`
- Launch with an explicit provider, model, and thinking level
- If your `$HC_TERMINAL_ID` is set, tell it to report with `hc send <your $HC_TERMINAL_ID>` when done or stuck, substituting your actual terminal address
- If a worker-notification tool such as `hc_watch` is available, register each worker with it instead of polling
- Accept work from its actual results (diff, output, files), not its status
- Ask for proofs (runs, screenshots, etc) that things work as expected
- Manage, steer and clean up only the terminals you started
- If you're orchestrating, get back to the user once you've delegated the tasks to continue the conversation while the subagents work (they'll steer when done)

## Guidelines

- For coding, use Pi with Opus 5.5 on medium
- As an oracle, use Pi with Astra 6 on xhigh
- For research and exploration, run both Sol 6.1 and Opus 5.5 on high with Pi
- By default use `pi`, when specified, use `codex` or `claude` CLIs
