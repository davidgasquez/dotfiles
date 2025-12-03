# Commit

## Goal

Create well-formatted commits with the conventional commits style mixed with emoji (gitmoji).

1. Checks which files are staged with `git status`.
2. Check historical commits to learn style and tone (`git log --oneline -30`).
3. Analyze the diff to determine if multiple distinct logical changes are present (`git diff HEAD`).
4. If multiple distinct changes are detected, break the commit into multiple smaller commits.
5. For each commit (or the single commit if not split), create a commit message using the commit convention.
  1. Add all relevant changes with `git add`.
  2. Performs a `git diff` to understand what actual changes are being committed
  3. Write the descriptive and concise commit message.
6. Return the list of commits to the user.

## Commit Style

- **Atomic commits**: Each commit should contain related changes that serve a single purpose.
- **Split large changes**: If changes touch multiple concerns, split them into separate commits. Always reviews the commit diff to ensure the message matches the changes
- **Concise first line**: Keep the first line under 72 characters. Do not end the subject line with a period.
- **Present tense, imperative mood**: Use the imperative mood in the subject line.
- **Conventional commit format**: Use the format `<emoji> <description>`. Description shouldn't contain explicit scope (e.g. `network:`).

## Guidelines for Splitting Commits

When analyzing the diff, consider splitting commits based on these criteria:

1. **Different concerns**: Changes to unrelated parts of the codebase
2. **Different types of changes**: Mixing features, fixes, refactoring, etc.
3. **File patterns**: Changes to different types of files (e.g., source code vs documentation)
4. **Logical grouping**: Changes that would be easier to understand or review separately
5. **Size**: Very large changes that would be clearer if broken down

## Examples

- ✨ Add user authentication system
- 🐛 Resolve memory leak in rendering process
- 📝 Update API documentation with new endpoints
- ♻️ Simplify error handling logic in parser
- 🚨 Resolve linter warnings in component files
- 🧑‍💻 Improve developer tooling setup process
- 👔 Implement business logic for transaction validation
- 🩹 Address minor styling inconsistency in header
- 🚑️ Patch critical security vulnerability in auth flow
- 🎨 Reorganize component structure for better readability
- 🔥 Remove deprecated legacy code
- 🦺 Add input validation for user registration form
- 💚 Resolve failing CI pipeline tests
- 📈 Implement analytics tracking for user engagement
- 🔒️ Strengthen authentication password requirements
- ♿️ Improve form accessibility for screen readers
