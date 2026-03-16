---
name: self-contained-python-script
description: Write self-installing self-contained Python scripts using uv and PEP 723
---

Use this to write Python tools / scripts / CLIs as single files.

- Add dependencies with `uv add --script foo.py httpx`.
- Run with `uv run foo.py`.
- If inline metadata is present, `uv run` ignores project dependencies automatically.

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

- `dependencies` must be present, even if empty: `dependencies = []`.
