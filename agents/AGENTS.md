# Rules

- Agentic, proactive (run commands, read docs, ...), concise, direct, and technical
- Explicit is better than implicit
- Flat is better than nested
- Practicality beats purity
- Follow the UNIX Philosophy (do one thing and do it well)
- Aim for fast, deterministic feedback loops (tests, linters, type checks, hooks)
- Embrace simplicity and immutability
- Do the simplest thing that could work (KISS, don't over-engineer)
- Write functional code with small, composable and modular functions/modules/components with explicit interfaces
- Functions over clever abstractions, clarity over magic
- When unsure, don't guess, read more code and gather more context (search, ask, list explicit trade-offs, ...)
- Call out bad ideas, unreasonable expectations, mistakes, ...
- After applying changes, verify they work (run code, lint, tests, ...)
- Make debugging easy yourself with concise/clear logs and assertions that help debugging without noise
- Keep files small (<~500 LOC) and split/refactor as needed
- Write clean, modular code with modern syntax and type annotations
- Don't code defensively
  - Fail-fast behavior with actionable, structured error messages
  - Fail early and often. No need to try-catch
  - Failures should be visible and actionable
  - Check conditions proactively rather than relying on exceptions for control flow
- The best code is no code (remove code that is not needed)
- Work in small, discrete, iterative steps
  - Create temporary scripts to learn more about APIs, schemas and datasets shape/values
- Human-in-the-loop checkpoints for risky or high-impact changes
  - Never run destructive git operations (e.g., `git reset --hard`, `rm`, `git checkout`/`git restore` to an older commit) unless the user gives an explicit, written instruction in a conversation.
- Rely on the build system (usually `Makefile`) commands for running, testing, linting, ...
  - A single command should setup, run, test, lint, and format the project
- Use `tmux` for background jobs, async tasks, or anything you'll come back to it
  - Run development servers, long running processes you need to audit, run tests in the background, tail logs
  - Design workflows so they are observable without constant (blocking) babysitting (use tmux panes, logs, log-tail scripts, ...)
- No flowery language, em dashes (—), en dashes (–), or semicolons (;)

## Git

- Commits
  - Atomic commits (split changes into small, logical units)
  - Short and clear descriptive messages
  - Prepend a relevant emoji (🐛 Fix upsert logic)
- Pull Requests
  - Concise and short description of the changes (no header/title)
  - Prepend a relevant emoji to the PR title (🚀 Publish new version)
- Branches
  - Clean and relevant name
  - Use basic names (`fix-async-stream`, `add-users-model`)
- Use `gh` CLI for PRs, reviews, issues, ...
