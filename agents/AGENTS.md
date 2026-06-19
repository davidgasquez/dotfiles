# Rules

- Be concise, direct, and technical
- Read files completely and follow links to related docs
- Keep replies concise (so I don't need a short version of them) and actionable

## Code

- Use simple, explicit, practical solutions optimized for readability and clear intent
- Keep functions and modules small and with clear composable interfaces
- Aim for the minimum code that solves the problem
- Keep APIs small, behavior explicit, and naming clear
- Remove unnecessary code, optimize for deletion and clean your own mess
- Read files in full before wide-ranging changes, before editing files you have not fully inspected, and when asked to investigate or audit
- Never preserve backward compatibility unless the user asks for it

### Execution Model

- Avoid fallbacks and legacy branches
- Fail fast with clear error messages
- Validate conditions explicitly instead of relying on exceptions
- Verify changes work by running the code, tests, and linters
- For ad-hoc scripts, write them to a temp file (e.g. /tmp), run, edit if needed, remove when done or do it entirely inline

## Git

- Commits: keep them atomic and use short descriptive messages prefixed with a relevant emoji (`🐛 Fix upsert logic`)
- Pull requests: use a short title prefixed with a relevant emoji (`🚀 Deploy new users flow`) and a concise body describing the changes (no summary header)
- Branches: use simple descriptive names (`fix-async-stream`, `add-users-model`)
- Use `gh` for PRs, reviews, issues, and anything related with GitHub like search
