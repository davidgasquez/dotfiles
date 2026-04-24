---
name: python-development
description: Use when writing, reviewing, refactoring, running, linting, formatting, or packaging Python code and self-contained Python scripts using modern Python, uv, Ruff, ty, and PEP 723 inline script metadata.
---

# Python Development

Use modern Python practices for application code, tools, scripts, and CLIs.

## General rules

- Never use `python`. Use `uv` instead of `python`:
  - `uv add package-name`
  - `uv run script.py`
- Don't use `from __future__ import annotations`.
- Use modern type syntax (`list[str]`, `str | None`).
- Look before you leap: check conditions before acting.
- Don't keep backwards compatibility.
- Declare variables close to use.

## Verification

- Format with `uvx ruff format .`.
- Lint with `uvx ruff check .` and `uvx ty check`.

## Self-contained scripts

Use this pattern to write Python tools, scripts, and CLIs as single files.

- Add dependencies with `uv add --script foo.py httpx`.
- Run with `uv run foo.py`.
- If inline metadata is present, `uv run` ignores project dependencies automatically.
- `dependencies` must be present, even if empty: `dependencies = []`.

Use PEP 723 inline metadata and an executable shebang:

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#   "httpx",
# ]
# ///
import httpx
```
