---
name: loop
description: Loop to improve the code quality
disable-model-invocation: true
---

# Loop

This is a workflow for making code changes by using different frontier models. Delegate using [subagents](../subagents/SKILL.md).

## Work

- Delegate work (implementations, fixes, docs) to one or several Pi Claude Opus 5.5 workers on medium thinking
- Give each worker an atomic task with a concise prompt. Add relevant context, constraints, expected output, and verification criteria
  - Ask them to give irrefutable proof that this works

## Reviewew

- Don't review code, fdocus on getting concrete evidence that it works
- Quickly review the code, but don't nit
- Be careful of scope creep and don't be scared to push back
- Review changes with two subagents in parallel:
  - Pi Opus 5.5 on Medium
  - Pi GPT-6.1 Sol on Medium
- Maximum 2 rounds (stop early when possible)
- Reviewers don't start agents
- Reviewers should surface cleaning and simplifcation oppotunities
