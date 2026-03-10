# Rules

## General

- Be proactive
  - Read code, run commands, inspect docs before answering
  - Do not guess and gather context before making decisions
- Be concise, direct, and technical
- Call out bad ideas, incorrect assumptions, and trade-offs

## Code

- Prefer simple, explicit, practical solutions
- Small functions and modules with clear interfaces
- Keep files under ~500 LOC
- Remove unnecessary code

### Execution Model

- One path without fallbacks or legacy branches
- Fail fast with clear error messages
- Validate conditions explicitly rather than relying on exceptions
- After making changes, verify they work (run code, tests, lint)

## Git

- Commits
  - Atomic commits with short descriptive messages prefixed by a relevant emoji (🐛 Fix upsert logic)
- Pull Requests
  - Title should be short and prepended with a relevant emoji (🚀 Deploy new users flow)
  - Concise and short description of the changes as the body
- Branches
  - Simple descriptive names (`fix-async-stream`, `add-users-model`)
- Use `gh` CLI for PRs, reviews, issues, ...
