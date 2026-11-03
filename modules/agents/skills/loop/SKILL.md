---
name: loop
description: Loop to improve the code quality
disable-model-invocation: true
---

# Loop

This is a workflow for making code changes by using different frontier models to implement and review code in a loop. Delegate using [subagents](../subagents/SKILL.md).

## Work

- Delegate work (implementations, fixes, docs) to one or several Pi Claude Opus 5.5 workers on medium thinking
- Give each worker an atomic task with a concise prompt. Add relevant context, constraints, expected output, and verification criteria

## Review

- Make the most minimal possible changes to appease the reviewers
- Be careful of scope creep and don't be scared to push back
- Review changes with two subagents in parallel:
  - Pi Opus 5.5 on Medium
  - Pi GPT-6.1 Sol on Medium
- Maximum 2 rounds (stop early if a round returns only nits)
- Reviewers don't start agents
- Reviewers should surface cleaning and simplifcation oppotunities
