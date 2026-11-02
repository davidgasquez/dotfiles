---
name: delegate
description: Delegate work to other agents with hc. Use only when the operator authorizes delegation.
disable-model-invocation: true
---

# Delegate

Run `hc --skill` once for the hc manual, then:

- Delegate only when the operator authorized it
- Give each worker one concise, atomic task with context, constraints, expected output, and verification
- Launch with an explicit provider, model, and thinking level
- Keep one writer per checkout, or give each writer its own worktree
- Tell each worker not to start agents and to report with `hc send <your $HC_TERMINAL_ID>` when done or stuck
- Accept work from its actual results (diff, output, files), not its status
- Clean up only the terminals you started
