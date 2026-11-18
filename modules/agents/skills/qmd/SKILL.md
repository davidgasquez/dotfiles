---
name: qmd
description: Search local Markdown notes, documentation, and knowledge bases with QMD.
disable-model-invocation: true
---

# QMD

Read the guide bundled with the installed CLI:

```bash
qmd skill show
```

Search indexed local notes before the web when they may already contain the answer.

- Use `qmd search` for exact terms and structured `qmd query` for conceptual searches.
- Write the `intent:`, `lex:`, `vec:`, and `hyde:` fields yourself as appropriate rather than relying on automatic expansion.
- If model-backed search fails, fall back to `qmd search`.
