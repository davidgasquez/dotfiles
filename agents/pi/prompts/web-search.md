---
name: web-search
description: Generic web search. Use when you need fast, headless web search.
---

# Web Search

Search the web in a headless and fast way.

## Workflow

1. Run `web-search "<query>"` (with a large timeout like 60s)
  - The script uses Codex defaults for model and reasoning unless overridden (check `--help` if needed)
  - You might want to run multiple `web-search` in parallel with different wording and focus
2. Fetch the most relevant pages with the `web-fetch` skill as needed
3. Merge, deduplicate, and use the findings accordingly
4. Repeat if needed

Example:

```bash
web-search "latest stable Rust release and best sources"
```
