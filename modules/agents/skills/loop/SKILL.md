---
name: loop
description: Loop to improve the code quality
disable-model-invocation: true
---

# Loop

This is a workflow for making your code changes more correct before (or sometimes after) filing a pull request by using different frontier models to implement and review your code in a loop.

## Implement

- Delegate implementations / fixes / docs to one or several Pi Claude Opus 5.5 on high thinking effort models
- Give each one an atomic task
- Give concise prompts with the task with relevant context, constraints, expected output, and verification criteria

## Review

- Make the most minimal possible changes to appease the reviewers
- Be careful of scope creep and don't be scared to push back
- Review changes with Pi Opus 5.5 and Pi GPT-6.1 Sol
- Maximum 2 rounds (stop early if a round returns only nits)
- Reviewers don't create subagents
- Reviewers should surface cleaning and simplifcation oppotunities
