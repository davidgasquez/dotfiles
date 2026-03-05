---
description: Refactor code to be simpler while maintaining identical functionality
---

Refactor $ARGUMENTS to be simpler, clearer, and more maintainable without changing what it does.

## Objective

Simplify and clean the code. Implementation should be straightforward and pragmatic. The goal is to get the most minimal code possible.

## Principles

- Behavior parity. Keep interfaces and semantics identical. No new features. Preserve flags, return codes, and observable side effects.
- KISS. Prefer boring, obvious solutions over cleverness. Fewer moving parts over fewer lines.
- Small pieces. Favor small, composable functions. Design for easy deletion and iteration.
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
