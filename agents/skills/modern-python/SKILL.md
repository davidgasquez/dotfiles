---
name: modern-python
description: How to work with Python (`uv` instead of `python`, modern type syntax, linting, formatting, etc.)
---

- Use `uv` instead of `python`
  - `uv add package-name`
  - `uv run script.py`
- Don't use `from __future__ import annotations`
- Use modern type syntax (`list[str], str | None`)
- Format with `uvx ruff format .`
- Lint with `uvx ruff check .` and `uvx ty check`
- Look before you leap (check conditions before acting)
