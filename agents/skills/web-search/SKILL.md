---
name: web-search
description: Use when you need fast, headless web search.
---

# Jina AI Search

Use Jina AI’s public endpoints to search the web

## When to Use

- You need quick web search results without an API key or browser
- You need readable page content from a URL for summarization or analysis
- You need to access X/Twitter content

## Reference

### Search (s.jina.ai)

```
https://s.jina.ai/YOUR_SEARCH_QUERY
```

1. Search for pages

```bash
curl "https://s.jina.ai/jina%20ai%20reader%20usage"
```

- URL-encode spaces and special characters in the query.
- Output returns search results with titles/snippets/links (plain text).

2. Fetch readable page content

```bash
curl "https://r.jina.ai/https://example.com/article"
```

- Prepend `https://r.jina.ai/` to any HTTP/HTTPS URL.
- Output is readable text/markdown for the target page.

Typical workflow is to:

1. Use `s.jina.ai` to discover relevant links.
2. Use `r.jina.ai` to fetch readable content from those links.
