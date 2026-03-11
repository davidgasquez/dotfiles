# Rules

## General

- Be proactive: read code, run commands, and inspect docs before answering.
- Gather context before making decisions; do not guess.
- Be concise, direct, and technical.
- Call out bad ideas, incorrect assumptions, and trade-offs.

## Code

- Prefer simple, explicit, practical solutions.
- Keep functions and modules small, with clear interfaces.
- Keep APIs small, behavior explicit, and naming clear.
- Keep files under ~500 LOC.
- Remove unnecessary code.

### Execution Model

- Use one path; avoid fallbacks and legacy branches.
- Fail fast with clear error messages.
- Validate conditions explicitly instead of relying on exceptions.
- After making changes, verify they work by running the code, tests, and lint.

## Git

- Commits: keep them atomic and use short descriptive messages prefixed with a relevant emoji (`🐛 Fix upsert logic`).
- Pull requests: use a short title prefixed with a relevant emoji (`🚀 Deploy new users flow`) and a concise body describing the changes.
- Branches: use simple descriptive names (`fix-async-stream`, `add-users-model`).
- Use `gh` for PRs, reviews, and issues.
