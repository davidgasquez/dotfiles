---
description: Refactor code to be simpler while maintaining identical functionality
---

# Simplify

Read and understand $ARGUMENTS.

Refactor code to be simpler while maintaining identical functionality. Simple code is easier to understand, change, debug and more flexible, not just shorter.

Focus on $ARGUMENTS.

## Steps

1. **Analyze** - Understand purpose, identify edge cases
2. **Remove** - Dead code, unused variables, redundant operations
3. **Simplify** - Complex conditionals, verbose constructs, unnecessary state
4. **Restructure** - Extract common code, flatten nesting, use early returns
5. **Verify** - Test that behavior remains identical

## Focus Areas

- Replace custom implementations with built-ins
- Combine similar functions
- Use clearest variable/function names
- Apply KISS principle

## Constraints

- MUST produce identical outputs for all inputs
- MUST maintain same public API/interface
