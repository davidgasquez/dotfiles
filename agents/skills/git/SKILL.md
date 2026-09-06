---
name: git
description: Apply Git and GitHub conventions when working with changes, commits, branches, pull requests, reviews, or issues.
---

# Git

- Use non-interactive commands and `gh` for GitHub operations, including PRs, reviews, issues, and search.
- Use simple, descriptive branch names (`fix-async-stream`, `add-users-model`).

## Commits

- When asked to commit, inspect `git status` and `git --no-pager diff HEAD`.
- Keep commits atomic; split independent changes into separate commits.
- Stage only relevant changes and review `git --no-pager diff --cached` before committing.
- Use `git commit -m "<emoji> <description>"` with an imperative subject under 72 characters, no explicit scope, and no trailing period (`🐛 Fix upsert logic`).
- Ensure each message accurately reflects its diff and report the resulting commits.

## PR

- Use a short, emoji-prefixed title (`🚀 Deploy new users flow`).
- Keep the body concise and describe the changes, with no summary header or validation section.
