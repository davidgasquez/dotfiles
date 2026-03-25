# Rules

## General

- Be concise, direct, and technical.
- Be proactive: read code, run commands, and inspect docs before answering.
- Gather context before making decisions; do not guess.
- Call out bad ideas, incorrect assumptions, and trade-offs.
- Prefer `edit` for existing files (`write` only for new files or big refactors).
- Parallelize async independent work (reads, searches, checks, or disjoint `edit` calls) into `tmux` sessions.
- Every piece of knowledge or logic should exist in exactly one place.

## Code

- Prefer simple, explicit, practical solutions optimized for readability and clear intent.
- Keep functions and modules small and with clear composable interfaces.
- Keep APIs small, behavior explicit, and naming clear.
- Keep files under ~500 LOC.
- Remove unnecessary code.

### Execution Model

- Avoid fallbacks and legacy branches.
- Fail fast with clear error messages.
- Validate conditions explicitly instead of relying on exceptions.
- Verify changes work by running the code, tests, and linters.

## Git

- Commits: keep them atomic and use short descriptive messages prefixed with a relevant emoji (`🐛 Fix upsert logic`).
- Pull requests: use a short title prefixed with a relevant emoji (`🚀 Deploy new users flow`) and a concise body describing the changes (no summary header).
- Branches: use simple descriptive names (`fix-async-stream`, `add-users-model`).
- Use `gh` for PRs, reviews, and issues.
