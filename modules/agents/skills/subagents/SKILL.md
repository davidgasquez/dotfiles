---
name: subagents
description: Orchestrate and delegate work to other agents with hc. Use only when the operator authorizes delegation.
disable-model-invocation: true
---

# Subagents

Read `hc --skill` before delegating.

- Give each worker one concise, atomic task with context, constraints, expected output, and how to verify their work
- Workers of a chat shown in Herdr appear under it in the Agents list. If the user wants a separate tab or the chat has no Herdr pane, read `herdr-app --skill`. Reuse or create a space on the worker's machine named after the basename of the chat's working folder and pass its ID with `hc run --label "herdr.space=<id>"`.
- Launch in the background with an explicit provider, model, and thinking level. If `hc run` includes the task, check `first_message.sent`. If delivery fails or is unclear, inspect the terminal before resending. For a bare launch, wait for readiness before sending the task.
- Name each worker with `hc run --name <task>-<role>`, adding a numeric suffix if needed for uniqueness. Keep the exact address returned by `hc run`, including the `machine/` prefix for remote workers, and use it for subsequent `hc` commands.
- Follow up with a live worker using `hc send <address>`. If it has exited and you need its context, start a worker on the same machine and in the same working directory using the harness's resume command, such as `pi --session <path-or-id>`. Keep the new terminal address for subsequent commands.
- If your `$HC_TERMINAL_ID` is set, tell it to report with `hc send <your $HC_TERMINAL_ID>` when done or stuck, substituting your actual terminal address
- In a local desktop chat with `hc_watch`, register each worker using its returned address. If the watch is lost, register again. Use `hc wait <terminal>` when you need the result and the notice hasn't arrived, including when the tool is unavailable or registration or delivery fails.
- Accept work from its actual results (diff, output, files), not its status
- Ask for proofs (runs, screenshots, etc) that things work as expected
- Manage, steer and clean up only the terminals you started
- If the request needs the workers' results, keep the turn open until you've collected and verified them. If the user asks to leave the work running in the background, report what started and include the terminal addresses.

## Guidelines

- For coding, use Pi with Opus 5.5 on medium
- As an oracle, use Pi with Astra 6 on xhigh
- For research and exploration, run both Sol 6.1 and Opus 5.5 on high with Pi
- By default use `pi`, when specified, use `codex` or `claude` CLIs
