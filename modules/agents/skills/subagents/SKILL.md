---
name: subagents
description: Orchestrate and delegate work to other agents with hc. Use only when the operator authorizes delegation.
disable-model-invocation: true
---

# Subagents

Read `hc --skill` before delegating.

- Give each worker one concise, atomic task with context, constraints, expected output, and how to verify their work
- Workers of a chat shown in Herdr appear under it in the Agents list. If the user wants a separate tab or the chat has no Herdr pane, read `herdr-app --skill`. Reuse or create a space on the worker's machine named after the basename of the chat's working folder and pass its ID with `hc run --label "herdr.space=<id>"`.
- Launch in the background with an explicit provider, model, and thinking level. Launch Pi workers in the actual project working directory with `--session-dir '~/.pi/agent/sessions/.subagents/pi'`, keeping the tilde literal so Pi expands it on the worker's machine. If `hc run` includes the task, check `first_message.sent` in the JSON that `hc run` prints. If delivery fails or is unclear, inspect the terminal before resending. For a bare launch, wait for readiness before sending the task.
- Name each worker with `hc run --name <task>-<role>`, adding a numeric suffix if needed for uniqueness. Keep the exact address returned by `hc run`, including the `machine/` prefix for remote workers, and use it for subsequent `hc` commands.
- Follow up with a live worker using `hc send <address>`. If it has exited and you need its context, start a worker on the same machine and in the same working directory using the harness's resume command. For Pi, prefer `pi --session <absolute-jsonl-path>`, or use the same `--session-dir` with `--session <id>` from the original working directory. Keep the new terminal address for subsequent commands.
- If your `$HC_TERMINAL_ID` is set, tell it to report with `hc send <your $HC_TERMINAL_ID>` when done or stuck, substituting your actual terminal address
- In a local desktop chat with `hc_watch`, register each worker using its returned address. If the watch is lost, register again. Use `hc wait <terminal> --timeout 1800` (or `hc wait --children all --timeout 1800`) when you need the result and the notice hasn't arrived, including when the tool is unavailable or registration or delivery fails. A `timeout` or `message` reason is a check-in, not a result: handle the message, then wait again. Read a worker's output files only after it reports done.
- Accept work from its actual results (diff, output, files), not its status
- Ask for proofs (runs, screenshots, etc) that things work as expected
- Manage, steer and clean up only the terminals you started. Inspect with `hc get` and `hc read` (there is no `hc status`); `hc kill` and `hc rm` take one terminal each.
- If the request needs the workers' results, keep the turn open until you've collected and verified them. If the user asks to leave the work running in the background, report what started and include the terminal addresses.

## Guidelines

- For coding, use Pi with on medium
- As an oracle, use Pi with Astra on xhigh
- For research and exploration, run both Sol 6.1 and Opus 5.5 on high with Pi
- Pi model flags: Opus is `--provider anthropic --model claude-opus-5-5`, Sol is `--provider openai --model gpt-6.2-sol`, Astra is `--provider openai --model gpt-6.2-astra`
- By default use `pi`, when specified, use `codex` or `claude` CLIs
