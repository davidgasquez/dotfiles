---
name: subagents
description: Orchestrate and delegate work to other agents with hc. Use only when the operator authorizes delegation.
disable-model-invocation: true
---

# Subagents

Run `hc --skill` once for the hc manual, then:

- Give each worker one concise, atomic task with context, constraints, expected output, and verification
- Launch with an explicit provider, model, and thinking level
- Keep one writer per checkout, or give each writer its own worktree
- If your `$HC_TERMINAL_ID` is set, tell it to report with `hc send <your $HC_TERMINAL_ID>` when done or stuck, substituting your actual terminal address
- If a worker-notification tool such as `hc_watch` is available, register each worker with it instead of polling
- Accept work from its actual results (diff, output, files), not its status
- Clean up only the terminals you started
- If you're orchestrating, get back to the user once you've delegated the tasks to continue the conversation while the subagents work (they'll steer when done)
