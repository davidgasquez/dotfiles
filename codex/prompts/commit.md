# Commit

## Goal

Create well-formatted commits with the conventional commits style mixed with emoji (gitmoji).

1. Checks which files are staged with `git status`.
2. Check historical commits to learn style and tone (`git log --oneline -40`).
3. Analyze the diff to determine if multiple distinct logical changes are present (`git diff HEAD`).
4. If multiple distinct changes are detected, break the commit into multiple smaller commits.
5. For each commit (or the single commit if not split), create a commit message using the commit convention.
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

  - 🎨 Improve structure / format of the code
  - ⚡️ Improve performance
  - 🔥 Remove code or files
  - 🐛 Fix a bug
  - 🚑️ Critical hotfix
  - ✨ Introduce new features
  - 📝 Add or update documentation
  - 🚀 Deploy stuff
  - 💄 Add or update the UI and style files
  - 🎉 Begin a project
  - ✅ Add, update, or pass tests
  - 🔒️ Fix security or privacy issues
  - 🔐 Add or update secrets
  - 🔖 Release / Version tags
  - 🚨 Fix compiler / linter warnings
  - 🚧 Work in progress
  - 💚 Fix CI Build
  - ⬇️ Downgrade dependencies
  - ⬆️ Upgrade dependencies
  - 📌 Pin dependencies to specific versions
  - 👷 Add or update CI build system
  - 📈 Add or update analytics or track code
  - ♻️ Refactor code
  - ➕ Add a dependency
  - ➖ Remove a dependency
  - 🔧 Add or update configuration files
  - 🔨 Add or update development scripts
  - 🌐 Internationalization and localization
  - ✏️ Fix typos
  - 💩 Write bad code that needs to be improved
  - ⏪️ Revert changes
  - 🔀 Merge branches
  - 📦️ Add or update compiled files or packages
  - 👽️ Update code due to external API changes
  - 🚚 Move or rename resources (e.g.: files, paths, routes)
  - 📄 Add or update license
  - 💥 Introduce breaking changes
  - 🍱 Add or update assets
  - ♿️ Improve accessibility
  - 💡 Add or update comments in source code
  - 🍻 Write code drunkenly
  - 💬 Add or update text and literals
  - 🗃️ Perform database related changes
  - 🔊 Add or update logs
  - 🔇 Remove logs
  - 👥 Add or update contributor(s)
  - 🚸 Improve user experience / usability
  - 🏗️ Make architectural changes
  - 📱 Work on responsive design
  - 🤡 Mock things
  - 🥚 Add or update an easter egg
  - 🙈 Add or update a .gitignore file
  - 📸 Add or update snapshots
  - ⚗️ Perform experiments
  - 🔍️ Improve SEO
  - 🏷️ Add or update types
  - 🌱 Add or update seed files
  - 🚩 Add, update, or remove feature flags
  - 🥅 Catch errors
  - 💫 Add or update animations and transitions
  - 🗑️ Deprecate code that needs to be cleaned up
  - 🛂 Work on code related to authorization, roles and permissions
  - 🩹 Simple fix for a non-critical issue
  - 🧐 Data exploration/inspection
  - ⚰️ Remove dead code
  - 🧪 Add a failing test
  - 👔 Add or update business logic
  - 🩺 Add or update healthcheck
  - 🧱 Infrastructure related changes
  - 🧑‍💻 Improve developer experience
  - 💸 Add sponsorships or money related infrastructure
  - 🧵 Add or update code related to multithreading or concurrency
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
