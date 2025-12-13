---
description: Create atomic git commits using conventional commits prepended with emojis.
---

# Commit

Create atomic git commits using conventional commits prepended with emojis.

## Constraints (Non-Interactive)

This prompt runs unattended (e.g. from a detached tmux session).

- Use only non-interactive commands.
- Never open an editor or pager.
- Do not run `git push`.

## Process

- Inspect current changes with `git status` and `git --no-pager diff HEAD`.
- Decide whether the changes should be one commit or several logical commits.
- If multiple logical changes exist, plan and split them into separate commits.
- For each commit:
  - Stage only the relevant changes with `git add ...`.
  - Review the staged diff (e.g. `git --no-pager diff --cached`) to confirm what’s included.
  - Commit with a message (`git commit -m "…"`) following the style below.
- Return the commits to the user.

## Style

- **Atomic**: One concern per commit.
- **Split big changes**: Separate features, fixes, refactors, docs, etc. when they are independent.
- **Subject line**:
  - Format: `<emoji> <description>`
  - Imperative, present tense (e.g. "Add…", "Fix…").
  - Under 72 characters.
  - No trailing period.
  - Do not add explicit scopes like `feat:`, `network:`, `chore:`.
- Always ensure the commit message accurately reflects the diff.

## Splitting Commits

Split into multiple commits when:

- Changes touch unrelated parts of the codebase.
- Different types of work are mixed (feature, fix, refactor, docs, tests, chore).
- Different file types are mixed in a way that’s easier to review separately (e.g. code vs docs).
- The diff is very large and can be broken into smaller, easier-to-review steps.

## Examples

- ✨ Add user authentication system
- 🐛 Resolve memory leak in rendering process
- 📝 Update API documentation with new endpoints
- ♻️ Simplify error handling logic in parser
- 🎨 Reorganize component structure for better readability
- 🔥 Remove deprecated legacy code
- 💚 Resolve failing CI pipeline tests
- ♿️ Improve form accessibility for screen readers
