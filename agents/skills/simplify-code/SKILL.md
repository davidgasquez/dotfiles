---
name: simplify-code
description: Refactor code to be simpler while maintaining identical functionality
---

Refactor the relevant code to be simpler, clearer, and more maintainable without changing what it does.

## Objective

Simplify and clean the code. Implementation should be straightforward and pragmatic. The goal is to get the most minimal code possible with the minimal abstractions and cleaner interfaces.

## Principles

- Behavior parity. Keep interfaces and semantics identical. No new features. Preserve flags, return codes, and observable side effects.
- Apply project standards. Follow any conventions from AGENTS.md in this project.
- KISS. Prefer boring, obvious solutions over cleverness. Fewer moving parts over fewer lines.
- Small pieces. Favor small, composable functions. Design for easy deletion and iteration.
- Maintain balance. Do not over-simplify. Avoid overly clever solutions that are hard to understand. Do not combine too many concerns into single functions. Do not remove helpful abstractions. Prioritize readability over fewer lines.
- Prune aggressively. Remove dead code, unused vars, redundant branches, defensive over-engineering, and needless indirection.
- Flatten flow. Simplify complex conditionals and deep nesting. Use clear guards and early returns.
- Standard library first. Replace custom utilities with modern built-ins and framework primitives.
- Fail early and often. Avoid blanket try/catch blocks. Skip unnecessary validations.
- Communicate with types. Use types to express contracts and invariants. Avoid type acrobatics and generic abstractions.
- Abstractions when earned. Introduce or keep abstractions only when they reduce duplication or isolate likely change.
- Minimal deps. Do not add dependencies unless they materially simplify and are commonly available for the target runtime.
- No micro-optimizations unless they remove complexity or are explicitly required.
- Make rules explicit. Turn hidden assumptions into defaults, parameters, or assertions.
- Naming for intent. Prefer clear, intention-revealing names. One responsibility per function or module.

## Process

1. Read files and gather all the relevant context
2. Identify concrete improvements (dead code, unclear names, redundant logic, inconsistent patterns, many layers)
3. Apply changes one file at a time
4. After all changes, verify everything work
5. Summarize what you changed and why in a concise message

Do NOT add new features, change public APIs, or refactor code outside the listed files.
