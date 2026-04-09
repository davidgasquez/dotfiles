---
name: web-search
description: Generic web search. Use when you need fast, headless web search.
---

# Web Search

Search the web in a headless and fast way.

## Default workflow

1. Run `web-search "<query>"` (with a large timeout like 60s)
2. Open or fetch (`markdown-fetch` skill) the most relevant pages as needed
3. Merge, deduplicate, and use the findings accordingly
4. Repeat if needed

Example:

```bash
web-search "latest stable Rust release and best sources"
```
