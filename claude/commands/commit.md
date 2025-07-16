# Commit

Create well-formatted commits with the conventional commits style mixed with emoji (gitmoji).

1. Checks which files are staged with `git status`.
2. Check historical commits to learn style and tone (git log --oneline -40)
9. Analyze the diff to determine if multiple distinct logical changes are present.
7. If multiple distinct changes are detected, break the commit into multiple smaller commits.
8. For each commit (or the single commit if not split), create a commit message using the commit convention.
   1. Add all relevant changes with `git add`.
   2. Performs a `git diff` to understand what actual changes are being committed
   3. Write the descriptive and concise commit message.

## Commit Style

- **Atomic commits**: Each commit should contain related changes that serve a single purpose.
- **Split large changes**: If changes touch multiple concerns, split them into separate commits. Always reviews the commit diff to ensure the message matches the changes
- **Concise first line**: Keep the first line under 72 characters. Do not end the subject line with a period.
- **Present tense, imperative mood**: Use the imperative mood in the subject line.
- **Conventional commit format**: Use the format `<emoji> <description>`.

### Emoji Inspiration

  - ✨ New feature
  - 🐛 Bug fix
  - 📝 Documentation
  - 💄 Formatting/style
  - ♻️ Code refactoring
  - ⚡️ Performance improvements
  - ✅ Tests
  - 🔧 Tooling, configuration
  - 🚀 CI/CD improvements
  - 🗑️ Reverting changes
  - 🧪 Add a failing test
  - 🚨 Fix compiler/linter warnings
  - 🔒️ Fix security issues
  - 👥 Add or update contributors
  - 🚚 Move or rename resources
  - 🏗️ Make architectural changes
  - 🔀 Merge branches
  - 📦️ Add or update compiled files or packages
  - ➕ Add a dependency
  - ➖ Remove a dependency
  - 🌱 Add or update seed files
  - 🧑‍💻 Improve developer experience
  - 🧵 Add or update code related to multithreading or concurrency
  - 🔍️ Improve SEO
  - 🏷️ Add or update types
  - 💬 Add or update text and literals
  - 🌐 Internationalization and localization
  - 👔 Add or update business logic
  - 📱 Work on responsive design
  - 🚸 Improve user experience / usability
  - 🩹 Simple fix for a non-critical issue
  - 🥅 Catch errors
  - 👽️ Update code due to external API changes
  - 🔥 Remove code or files
  - 🎨 Improve structure/format of the code
  - 🚑️ Critical hotfix
  - 🎉 Begin a project
  - 🔖 Release/Version tags
  - 🚧 Work in progress
  - 💚 Fix CI build
  - 📌 Pin dependencies to specific versions
  - 👷 Add or update CI build system
  - 📈 Add or update analytics or tracking code
  - ✏️ Fix typos
  - ⏪️ Revert changes
  - 📄 Add or update license
  - 💥 Introduce breaking changes
  - 🍱 Add or update assets
  - ♿️ Improve accessibility
  - 💡 Add or update comments in source code
  - 🗃️ Perform database related changes
  - 🔊 Add or update logs
  - 🔇 Remove logs
  - 🤡 Mock things
  - 🥚 Add or update an easter egg
  - 🙈 Add or update .gitignore file
  - 📸 Add or update snapshots
  - ⚗️ Perform experiments
  - 🚩 Add, update, or remove feature flags
  - 💫 Add or update animations and transitions
  - ⚰️ Remove dead code
  - 🦺 Add or update code related to validation
  - ✈️ Improve offline support

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
